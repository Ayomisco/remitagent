import WDK from '@tetherto/wdk'
import WalletManagerTron from '@tetherto/wdk-wallet-tron'
import MoonPayFiat from '@tetherto/wdk-protocol-fiat-moonpay'

// Re-export WDK type alias for callers
export type { default as WDKType } from '@tetherto/wdk'

let wdkInstance: WDK | null = null

export async function getWDK(seedPhrase?: string): Promise<WDK> {
  if (wdkInstance) return wdkInstance

  const phrase = seedPhrase ?? process.env.MASTER_SEED_PHRASE ?? process.env.WDK_SEED
  if (!phrase) throw new Error('MASTER_SEED_PHRASE is not set. Generate one and add it to .env')

  const wdk = new WDK(phrase)

  // TRON (primary) — standard TRC-20 wallet via WDK
  // For gasfree (zero TRX needed), set GASFREE_* env vars and switch to wdk-wallet-tron-gasfree
  wdk.registerWallet('tron', WalletManagerTron, {
    provider: 'https://api.trongrid.io',
  })

  // Arbitrum (secondary) — only register if Candide keys are configured
  if (process.env.CANDIDE_BUNDLER_URL && process.env.CANDIDE_PAYMASTER_URL) {
    // Dynamic import so the package is optional
    const { default: WalletManagerEvmERC4337 } = await import('@tetherto/wdk-wallet-evm-erc-4337')
    ;(wdk as any).registerWallet('arbitrum', WalletManagerEvmERC4337, {
      provider: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
      bundler: process.env.CANDIDE_BUNDLER_URL,
      paymaster: process.env.CANDIDE_PAYMASTER_URL,
    })
  }

  // MoonPay fiat on-ramp (optional)
  if (process.env.MOONPAY_API_KEY && process.env.MOONPAY_SECRET_KEY) {
    ;(wdk as any).registerProtocol('tron', 'fiat-moonpay', MoonPayFiat, {
      apiKey: process.env.MOONPAY_API_KEY,
      secretKey: process.env.MOONPAY_SECRET_KEY,
    })
  }

  wdkInstance = wdk
  return wdkInstance
}

export function resetWDK(): void {
  wdkInstance = null
}
