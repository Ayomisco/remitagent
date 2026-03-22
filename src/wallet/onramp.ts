import { getWDK } from './wdk.js'
import { getUserWallet } from './userWallet.js'

export interface OnrampQuote {
  url: string
  estimatedUsdt: number
  fee: number
  provider: 'moonpay'
}

/**
 * Generate a MoonPay on-ramp URL for the user to buy USDt with fiat.
 * Returns a hosted checkout URL — no server-side KYC needed.
 */
export async function getFiatOnrampUrl(
  telegramUserId: string,
  fiatAmount: number,
  fiatCurrency: string = 'usd',
): Promise<OnrampQuote> {
  const { address } = await getUserWallet(telegramUserId, 'tron')

  // Use WDK fiat-moonpay protocol if available, else fall back to direct URL
  try {
    const wdk = await getWDK()
    const protocol = wdk.getProtocol('tron', 'fiat-moonpay')
    const quote = await protocol.getQuote({ fiatAmount, fiatCurrency, walletAddress: address })
    return {
      url: quote.url,
      estimatedUsdt: quote.cryptoAmount,
      fee: quote.feeAmount,
      provider: 'moonpay',
    }
  } catch {
    // Fallback: construct MoonPay URL directly
    const baseUrl = 'https://buy.moonpay.com'
    const params = new URLSearchParams({
      apiKey: process.env.MOONPAY_API_KEY ?? '',
      currencyCode: 'usdt_trc20',
      walletAddress: address,
      baseCurrencyAmount: String(fiatAmount),
      baseCurrencyCode: fiatCurrency.toLowerCase(),
    })
    return {
      url: `${baseUrl}?${params}`,
      estimatedUsdt: fiatAmount * 0.975, // ~2.5% MoonPay fee estimate
      fee: fiatAmount * 0.025,
      provider: 'moonpay',
    }
  }
}
