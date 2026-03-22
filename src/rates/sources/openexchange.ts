import type { RateQuote } from '../aggregator.js'

/**
 * Open Exchange Rates: fiat/fiat conversion.
 * Used to convert e.g. GBP → USD before doing USD → USDT.
 */
export async function getOpenExchangeRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<RateQuote> {
  const appId = process.env.OPENEXCHANGERATES_APP_ID
  if (!appId) throw new Error('OPENEXCHANGERATES_APP_ID not set')

  const res = await fetch(
    `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=USD`,
  )
  if (!res.ok) throw new Error(`OpenExchangeRates API error: ${res.status}`)

  const data = (await res.json()) as { rates: Record<string, number> }
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  const fromRate = data.rates[from] ?? 1 // USD = 1 by default
  const toRate = data.rates[to]
  if (!toRate) throw new Error(`OpenExchangeRates: no rate for ${to}`)

  // Convert: 1 fromCurrency = (toRate / fromRate) toCurrency
  const rate = toRate / fromRate

  return {
    source: 'OpenExchangeRates',
    rate,
    fee: 0.5,
    estimatedDelivery: '< 1 minute',
  }
}
