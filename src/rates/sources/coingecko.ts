import type { RateQuote } from '../aggregator.js'

// Maps common currency codes to CoinGecko vs_currency identifiers
const FX_MAP: Record<string, string> = {
  USD: 'usd', EUR: 'eur', GBP: 'gbp', NGN: 'ngn', BRL: 'brl',
  PHP: 'php', INR: 'inr', MXN: 'mxn', KES: 'kes', GHS: 'ghs',
  ZAR: 'zar', PKR: 'pkr', BDT: 'bdt', EGP: 'egp', IDR: 'idr',
}

export async function getCoinGeckoRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<RateQuote> {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  // USDT → local fiat: get USDT price in target currency
  if (from === 'USDT' || from === 'USD') {
    const vsCurrency = FX_MAP[to]
    if (!vsCurrency) throw new Error(`CoinGecko: unsupported target currency ${to}`)

    const apiKey = process.env.COINGECKO_API_KEY
    const headers: Record<string, string> = apiKey ? { 'x-cg-demo-api-key': apiKey } : {}

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${vsCurrency}`,
      { headers },
    )
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)
    const data = (await res.json()) as { tether: Record<string, number> }
    const rate = data.tether[vsCurrency]
    if (!rate) throw new Error(`CoinGecko: no rate for ${vsCurrency}`)

    return {
      source: 'CoinGecko',
      rate,
      fee: 0.5,
      estimatedDelivery: '< 1 minute',
    }
  }

  // Fiat → USDT: inverse
  const vsCurrency = FX_MAP[from]
  if (!vsCurrency) throw new Error(`CoinGecko: unsupported source currency ${from}`)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${vsCurrency}`,
  )
  const data = (await res.json()) as { tether: Record<string, number> }
  const usdtInFiat = data.tether[vsCurrency]
  return {
    source: 'CoinGecko',
    rate: 1 / usdtInFiat,
    fee: 0.5,
    estimatedDelivery: '< 1 minute',
  }
}
