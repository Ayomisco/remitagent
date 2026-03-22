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

  const baseUrl = 'https://buy.moonpay.com'
  const params = new URLSearchParams({
    apiKey: process.env.MOONPAY_API_KEY ?? '',
    currencyCode: 'usdt_trc20',
    walletAddress: address,
    baseCurrencyAmount: String(fiatAmount),
    baseCurrencyCode: fiatCurrency.toLowerCase(),
  })

  // Sign the URL if MoonPay secret key is available
  let url = `${baseUrl}?${params}`
  if (process.env.MOONPAY_SECRET_KEY) {
    try {
      const { createHmac } = await import('crypto')
      const signature = createHmac('sha256', process.env.MOONPAY_SECRET_KEY)
        .update(new URL(url).search)
        .digest('base64')
      params.set('signature', signature)
      url = `${baseUrl}?${params}`
    } catch {
      // signature optional, skip on failure
    }
  }

  return {
    url,
    estimatedUsdt: fiatAmount * 0.975, // ~2.5% MoonPay fee estimate
    fee: fiatAmount * 0.025,
    provider: 'moonpay',
  }
}
