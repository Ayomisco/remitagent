import type { RateQuote } from '../aggregator.js'

// Binance P2P and spot rates for USDT pairs
export async function getBinanceRate(
  fromCurrency: string,
  toCurrency: string,
  _amount: number,
): Promise<RateQuote> {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  // For USDT → fiat, use Binance P2P average (public endpoint)
  const fiatCurrencies = ['NGN', 'KES', 'GHS', 'ZAR', 'BRL', 'PHP', 'INR', 'PKR', 'EGP']

  if ((from === 'USDT' || from === 'USD') && fiatCurrencies.includes(to)) {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: to,
        merchantCheck: false,
        page: 1,
        publisherType: null,
        rows: 5,
        tradeType: 'SELL',
      }),
    })
    if (!res.ok) throw new Error(`Binance P2P error: ${res.status}`)
    const data = (await res.json()) as { data: Array<{ adv: { price: string } }> }
    const prices = data.data.map((d) => parseFloat(d.adv.price))
    const avgRate = prices.reduce((a, b) => a + b, 0) / prices.length

    return {
      source: 'Binance P2P',
      rate: avgRate,
      fee: 0,
      estimatedDelivery: '< 5 minutes',
    }
  }

  // USDT/USD spot pair
  if (from === 'USDT' && to === 'USD') {
    return { source: 'Binance', rate: 1, fee: 0.1, estimatedDelivery: '< 1 minute' }
  }

  throw new Error(`Binance: unsupported pair ${from}/${to}`)
}
