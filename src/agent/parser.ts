import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = `You are a remittance parsing assistant.
Extract structured data from user messages about sending money.
Always return valid JSON with exactly these fields:
- type: "send" | "balance" | "history" | "help" | "deposit" | "chat" | "unknown"
- amount: number (in fromCurrency) — null if not present
- fromCurrency: ISO currency code (USD, GBP, EUR, NGN, etc.) — default "USD" for send
- toCurrency: target currency if mentioned — null otherwise
- recipient: phone number, wallet address, or name — null if not present
- recipientCountry: country name or ISO code if mentioned — null otherwise

Use type "chat" for greetings, casual conversation, questions about the bot, or anything not financial.
Use type "send" for any money transfer intent.
Use type "balance" for any question about wallet balance or funds.
Use type "deposit" for requests to add funds, top up, buy crypto, etc.

Return ONLY valid JSON. No explanation, no markdown.`

const CHAT_SYSTEM_PROMPT = `You are RemitAgent — a smart, friendly AI assistant that users chat with on Telegram.

You are fully conversational. You can discuss anything: general knowledge, tech, crypto, finance, life advice, current events, jokes, whatever the user brings up. You have no topic restrictions.

You also have a special skill: sending money internationally in seconds for under 0.5% fee using USDt on TRON (via Tether WDK). When the user asks about their transfers, wallet, balance, or how a transaction went — you know about all of that from the conversation history.

Personality:
- Warm, human, like texting a smart and helpful friend
- Concise by default — 1-3 sentences unless more depth is needed
- When the user asks something detailed, give a detailed answer
- No markdown formatting (no **bold**, no bullet points) — this is Telegram chat
- Never refuse to answer a question by saying you can only help with payments`

export interface ParsedIntent {
  type: 'send' | 'balance' | 'history' | 'help' | 'deposit' | 'chat' | 'unknown'
  amount?: number
  fromCurrency?: string
  toCurrency?: string
  recipient?: string
  recipientCountry?: string
  rawText: string
}

// Broad regex patterns — catch natural language variations without hitting the LLM
const REGEX_PATTERNS: Array<{
  re: RegExp
  handler: (m: RegExpMatchArray) => Partial<ParsedIntent>
}> = [
  // Send: "send $200 to Maria", "send 50 usdt to T123..."
  {
    re: /\bsend\s+\$?(\d+(?:\.\d+)?)\s*(?:usdt?|usd)?\s+(?:to\s+)?(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'USD', recipient: m[2].trim() }),
  },
  // Transfer with currency symbols: £300, €200
  {
    re: /\btransfer\s+£(\d+(?:\.\d+)?)\s+to\s+(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'GBP', recipient: m[2].trim() }),
  },
  {
    re: /\btransfer\s+€(\d+(?:\.\d+)?)\s+to\s+(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'EUR', recipient: m[2].trim() }),
  },
  // Generic transfer: "transfer $50 to..."
  {
    re: /\btransfer\s+\$?(\d+(?:\.\d+)?)\s+(?:usdt?|usd)?\s*(?:to\s+)?(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'USD', recipient: m[2].trim() }),
  },
  // Balance: "what's my balance", "how much do i have", "check my wallet", etc.
  {
    re: /\b(balance|how much|my wallet|my funds|my usdt|check wallet|wallet balance|what.?s in|how many|do i have)\b/i,
    handler: () => ({ type: 'balance' }),
  },
  // History: "show history", "past transfers", etc.
  {
    re: /\b(history|transactions?|past (transfers?|payments?)|recent|show (my )?transfers?)\b/i,
    handler: () => ({ type: 'history' }),
  },
  // Deposit: "add funds", "top up", "buy usdt", "deposit"
  {
    re: /\b(deposit|add funds?|top.?up|buy usdt?|fund|add money|load)\b/i,
    handler: () => ({ type: 'deposit' }),
  },
  // Help: "/help", "what can you do", "commands", "help me"
  {
    re: /^\/?(help|commands?|what can you do|how do (i|you)|show me)\b/i,
    handler: () => ({ type: 'help' }),
  },
  // Send intent without amount: "can you help send money", "i want to send"
  {
    re: /\b(can you|i want to|i need to|help me|i.?d like to)\s+(send|transfer|remit|pay)\b/i,
    handler: () => ({ type: 'help' }),
  },
  // Greetings
  {
    re: /^(hi+|hey+|hello+|howdy|sup|yo+|hiya|good (morning|afternoon|evening|day)|what.?s up|greetings|howzit)/i,
    handler: () => ({ type: 'chat' }),
  },
  // "are you there", "are you active", "are you working"
  {
    re: /^are you\b/i,
    handler: () => ({ type: 'chat' }),
  },
  // "what are you doing", "what's your doing"
  {
    re: /^what.?s? (are you|your)\b/i,
    handler: () => ({ type: 'chat' }),
  },
]

// Keyword-based fallback when Gemini is unavailable
function keywordFallback(text: string): ParsedIntent {
  const t = text.toLowerCase()
  if (/balance|how much|wallet|funds/.test(t)) return { type: 'balance', rawText: text }
  if (/history|transactions?|transfers?/.test(t)) return { type: 'history', rawText: text }
  if (/send|transfer|remit|pay/.test(t)) return { type: 'help', rawText: text }
  if (/deposit|top.?up|add funds|buy usdt?/.test(t)) return { type: 'deposit', rawText: text }
  return { type: 'chat', rawText: text }
}

function getCannedReply(message: string): string {
  const t = message.toLowerCase()
  if (/hi|hey|hello|good (morning|afternoon|evening)|howdy/.test(t))
    return "Hey! Good to hear from you. What can I help you with?"
  if (/how are you|how r you|you good/.test(t))
    return "Doing great, thanks for asking! What's on your mind?"
  if (/what (are|can) you do|what is this|who are you/.test(t))
    return "I'm RemitAgent — I can chat about pretty much anything, and I can also send money internationally for you in seconds. What do you need?"
  return "I'm here! What's up?"
}

let geminiClient: GoogleGenerativeAI | null = null

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
    geminiClient = new GoogleGenerativeAI(apiKey)
  }
  return geminiClient
}

export async function parseIntent(message: string): Promise<ParsedIntent> {
  const text = message.trim()

  // Try regex first — zero API cost, handles most real-world inputs
  for (const { re, handler } of REGEX_PATTERNS) {
    const m = text.match(re)
    if (m) return { ...handler(m), rawText: text } as ParsedIntent
  }

  // Gemini fallback for complex / truly ambiguous messages
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = getGemini().getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 256 },
      })
      const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nUser message: "${text}"`)
      const parsed = JSON.parse(result.response.text())
      return { ...parsed, rawText: text }
    } catch (err) {
      console.error('[Parser] Gemini parseIntent error:', err)
    }
  }

  // Keyword-based fallback if Gemini unavailable
  return keywordFallback(text)
}

export async function generateChatReply(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = getGemini().getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
      })

      // Build full conversation context
      const historyText = history.length
        ? history.map((m) => `${m.role === 'user' ? 'User' : 'RemitAgent'}: ${m.content}`).join('\n')
        : ''

      const prompt = historyText
        ? `${CHAT_SYSTEM_PROMPT}\n\nConversation so far:\n${historyText}\n\nUser: ${message}\nRemitAgent:`
        : `${CHAT_SYSTEM_PROMPT}\n\nUser: ${message}\nRemitAgent:`

      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch (err) {
      console.error('[Parser] Gemini chat error:', err)
    }
  }

  return getCannedReply(message)
}
