import { redis } from '../db/redis.js'
import { getCoinGeckoRate } from './sources/coingecko.js'
import { getOpenExchangeRate } from './sources/openexchange.js'
import { getBinanceRate } from './sources/binance.js'
import { getYellowcardRate } from './sources/yellowcard.js'

export interface RateQuote {
  source: string
  rate: number           // 1 unit of fromCurrency = `rate` units of toCurrency
  fee: number            // percentage
  estimatedDelivery: string
}

const AFRICA_CURRENCIES = new Set(['NGN', 'KES', 'GHS', 'ZAR', 'UGX', 'TZS', 'RWF', 'XOF'])
const CACHE_TTL = 60 // seconds

/**
 * Returns sorted list of quotes (best rate first) for fromCurrency → toCurrency.
 * Results are cached in Redis for 60 seconds.
 */
export async function getBestRate(
  fromCurrency: string,
  toCurrency: string,
  amount: number = 100,
): Promise<RateQuote[]> {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()
  const cacheKey = `rate:${from}:${to}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached) as RateQuote[]
  } catch {
    // Redis unavailable — continue without cache
  }

  const fetchers: Array<Promise<RateQuote>> = [
    getCoinGeckoRate(from, to),
    getOpenExchangeRate(from, to),
    getBinanceRate(from, to, amount),
  ]

  if (AFRICA_CURRENCIES.has(to) || AFRICA_CURRENCIES.has(from)) {
    fetchers.push(getYellowcardRate(from, to, amount))
  }

  const results = await Promise.allSettled(fetchers)
  const quotes: RateQuote[] = results
    .filter((r): r is PromiseFulfilledResult<RateQuote> => r.status === 'fulfilled')
    .map((r) => r.value)

  if (quotes.length === 0) throw new Error('No rate sources available — please try again.')

  // Best rate = highest amount of target currency per unit of source currency
  const sorted = quotes.sort((a, b) => b.rate - a.rate)

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(sorted))
  } catch {
    // ignore cache write failures
  }

  return sorted
}

/**
 * How many USDt the user needs to send a given fiat amount.
 * Example: sendingUSD(200, 'USD') → ~200 (USDT ≈ USD 1:1)
 *          sendingUSD(200, 'GBP') → ~254 (at 1 GBP ≈ 1.27 USD)
 */
export async function fiatToUsdt(amount: number, fiatCurrency: string): Promise<number> {
  if (fiatCurrency.toUpperCase() === 'USDT' || fiatCurrency.toUpperCase() === 'USD') {
    return amount
  }
  const quotes = await getBestRate(fiatCurrency, 'USD', amount)
  const bestUsdRate = quotes[0].rate // 1 GBP = X USD
  return amount * bestUsdRate
}
