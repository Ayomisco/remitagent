import WDK from '@tetherto/wdk'
import WalletManagerEvmERC4337 from '@tetherto/wdk-wallet-evm-erc4337'
import WalletManagerTronGasfree from '@tetherto/wdk-wallet-tron-gasfree'
import MoonPayFiat from '@tetherto/wdk-protocol-fiat-moonpay'

let wdkInstance: WDK | null = null

export function getWDK(seedPhrase?: string): WDK {
  if (wdkInstance) return wdkInstance

  const phrase = seedPhrase ?? process.env.MASTER_SEED_PHRASE
  if (!phrase) throw new Error('MASTER_SEED_PHRASE is not set')

  wdkInstance = new WDK(phrase)
    .registerWallet('arbitrum', WalletManagerEvmERC4337, {
      provider: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
      bundler: process.env.CANDIDE_BUNDLER_URL!,
      paymaster: process.env.CANDIDE_PAYMASTER_URL!,
    })
    .registerWallet('tron', WalletManagerTronGasfree, {
      // Public endpoint works without API key (rate limited to 15 req/s)
      // Sign up at trongrid.io for a free key to remove limits
      provider: 'https://api.trongrid.io',
      ...(process.env.TRONGRID_API_KEY ? { apiKey: process.env.TRONGRID_API_KEY } : {}),
    })
    .registerProtocol('arbitrum', 'fiat-moonpay', MoonPayFiat, {
      apiKey: process.env.MOONPAY_API_KEY!,
    })

  return wdkInstance
}

export function resetWDK(): void {
  wdkInstance = null
}
