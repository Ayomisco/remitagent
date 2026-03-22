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

Use type "chat" for greetings, casual conversation, questions about the bot, or anything that isn't a financial action.
Use type "send" for any money transfer intent.
Use type "deposit" for requests to add funds, top up, buy crypto, etc.

Examples:
"Send $200 to João in Brazil" → {"type":"send","amount":200,"fromCurrency":"USD","recipient":"João","recipientCountry":"Brazil","toCurrency":"BRL"}
"Transfer £300 to my mum in Lagos" → {"type":"send","amount":300,"fromCurrency":"GBP","recipient":"mum","recipientCountry":"Nigeria","toCurrency":"NGN"}
"Send 50 USDT to TRX1abc...xyz" → {"type":"send","amount":50,"fromCurrency":"USDT","recipient":"TRX1abc...xyz","recipientCountry":null,"toCurrency":null}
"What's my balance?" → {"type":"balance","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"Show my transfer history" → {"type":"history","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"hey" → {"type":"chat","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"how are you?" → {"type":"chat","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"what is web3?" → {"type":"chat","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"how does this work?" → {"type":"chat","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"add funds" → {"type":"deposit","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}

Return ONLY valid JSON. No explanation, no markdown.`

const CHAT_SYSTEM_PROMPT = `You are RemitAgent, a friendly AI assistant for cross-border money transfers using USDt on TRON.
You help people send money internationally — fast, cheap, and without a bank.

Key facts:
- Fees: <0.5% (vs 8.5% Western Union)
- Speed: under 60 seconds
- No bank account needed
- Powered by Tether WDK on TRON blockchain

When someone greets you or asks a general question, respond naturally and helpfully.
Always gently steer the conversation toward what you can actually do: send money.
Be warm, concise, and conversational. Max 3 sentences.
Don't use markdown — this is a chat interface.`

export interface ParsedIntent {
  type: 'send' | 'balance' | 'history' | 'help' | 'deposit' | 'chat' | 'unknown'
  amount?: number
  fromCurrency?: string
  toCurrency?: string
  recipient?: string
  recipientCountry?: string
  rawText: string
}

// Fast regex paths — no LLM cost for the most common patterns
const REGEX_PATTERNS: Array<{
  re: RegExp
  handler: (m: RegExpMatchArray) => Partial<ParsedIntent>
}> = [
  {
    re: /^send\s+\$?(\d+(?:\.\d+)?)\s+(?:usdt?\s+)?to\s+(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'USD', recipient: m[2].trim() }),
  },
  {
    re: /^transfer\s+£(\d+(?:\.\d+)?)\s+to\s+(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'GBP', recipient: m[2].trim() }),
  },
  {
    re: /^transfer\s+€(\d+(?:\.\d+)?)\s+to\s+(.+)/i,
    handler: (m) => ({ type: 'send', amount: parseFloat(m[1]), fromCurrency: 'EUR', recipient: m[2].trim() }),
  },
  {
    re: /^(balance|wallet|how much do i have)/i,
    handler: () => ({ type: 'balance' }),
  },
  {
    re: /^(history|transactions?|transfers?|past payments?)/i,
    handler: () => ({ type: 'history' }),
  },
  {
    re: /^(help|\?|what can you do|commands)/i,
    handler: () => ({ type: 'help' }),
  },
  {
    re: /^(hi|hey|hello|howdy|sup|yo|hiya|good (morning|afternoon|evening)|what'?s up)/i,
    handler: () => ({ type: 'chat' }),
  },
  {
    re: /^(deposit|add funds?|top up|buy usdt?|fund)/i,
    handler: () => ({ type: 'deposit' }),
  },
]

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

  // Try fast regex first — zero API cost
  for (const { re, handler } of REGEX_PATTERNS) {
    const m = text.match(re)
    if (m) return { ...handler(m), rawText: text } as ParsedIntent
  }

  // Gemini fallback for complex / ambiguous messages
  try {
    const model = getGemini().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 256,
      },
    })

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nUser message: "${text}"`)
    const json = result.response.text()
    const parsed = JSON.parse(json)
    return { ...parsed, rawText: text }
  } catch (err) {
    console.error('[Parser] Gemini error:', err)
    return { type: 'unknown', rawText: text }
  }
}

export async function generateChatReply(message: string): Promise<string> {
  try {
    const model = getGemini().getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
    })
    const result = await model.generateContent(
      `${CHAT_SYSTEM_PROMPT}\n\nUser: "${message}"\nRemitAgent:`,
    )
    return result.response.text().trim()
  } catch {
    return "Hey! I'm RemitAgent — I help you send money internationally for less than 0.5% fee. Try: Send $100 to someone"
  }
}
