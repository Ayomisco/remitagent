import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = `You are a remittance parsing assistant.
Extract structured data from user messages about sending money.
Always return valid JSON with exactly these fields:
- type: "send" | "balance" | "history" | "help" | "save_recipient" | "unknown"
- amount: number (in fromCurrency) — null if not present
- fromCurrency: ISO currency code (USD, GBP, EUR, NGN, etc.) — default "USD" for send
- toCurrency: target currency if mentioned — null otherwise
- recipient: phone number, wallet address, or name — null if not present
- recipientCountry: country name or ISO code if mentioned — null otherwise

Examples:
"Send $200 to João in Brazil" → {"type":"send","amount":200,"fromCurrency":"USD","recipient":"João","recipientCountry":"Brazil","toCurrency":"BRL"}
"Transfer £300 to my mum in Lagos" → {"type":"send","amount":300,"fromCurrency":"GBP","recipient":"mum","recipientCountry":"Nigeria","toCurrency":"NGN"}
"Send 50 USDT to TRX1abc...xyz" → {"type":"send","amount":50,"fromCurrency":"USDT","recipient":"TRX1abc...xyz","recipientCountry":null,"toCurrency":null}
"What's my balance?" → {"type":"balance","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"Show my transfer history" → {"type":"history","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":null,"recipientCountry":null}
"Save Maria as my Mexico contact" → {"type":"save_recipient","amount":null,"fromCurrency":null,"toCurrency":null,"recipient":"Maria","recipientCountry":"Mexico"}

Return ONLY valid JSON. No explanation, no markdown.`

export interface ParsedIntent {
  type: 'send' | 'balance' | 'history' | 'help' | 'save_recipient' | 'unknown'
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
