import type { RateQuote } from '../aggregator.js'

// Yellowcard: African market rates (NGN, KES, GHS, ZAR, UGX, TZS, RWF, XOF)
export async function getYellowcardRate(
  fromCurrency: string,
  toCurrency: string,
  _amount: number,
): Promise<RateQuote> {
  const apiKey = process.env.YELLOWCARD_API_KEY
  if (!apiKey) throw new Error('YELLOWCARD_API_KEY not set')

  const res = await fetch(
    `https://api.yellowcard.io/v3/rates?sourceCurrency=${fromCurrency}&targetCurrency=${toCurrency}`,
    { headers: { 'API-Key': apiKey } },
  )
  if (!res.ok) throw new Error(`Yellowcard API error: ${res.status}`)

  const data = (await res.json()) as { rate: number; fee?: number }
  return {
    source: 'Yellowcard',
    rate: data.rate,
    fee: data.fee ?? 0.8,
    estimatedDelivery: '< 2 minutes',
  }
}
