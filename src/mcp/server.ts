/**
 * WDK MCP Server — OpenClaw / Claude / Cursor Integration
 *
 * This exposes RemitAgent's wallet capabilities as MCP tools so that
 * OpenClaw (or any MCP-compatible AI agent) can call them autonomously.
 *
 * Usage:
 *   npm run mcp          — starts the MCP server on stdio (for OpenClaw)
 *   WDK_SEED=... npm run mcp
 *
 * To connect in OpenClaw: add this server via ClawHub or point to this process.
 */
import { WdkMcpServer, WALLET_TOOLS, PRICING_TOOLS } from '@tetherto/wdk-mcp-toolkit'
import WalletManagerTronGasfree from '@tetherto/wdk-wallet-tron-gasfree'
import WalletManagerEvmERC4337 from '@tetherto/wdk-wallet-evm-erc4337'
import 'dotenv/config'

async function startMcpServer() {
  const seed = process.env.WDK_SEED ?? process.env.MASTER_SEED_PHRASE
  if (!seed) throw new Error('WDK_SEED (or MASTER_SEED_PHRASE) is required to start the MCP server')

  const server = new WdkMcpServer('remit-agent', '1.0.0')

  server.useWdk({ seed })

  // Register the same chains as the main app
  server.registerWallet('tron', WalletManagerTronGasfree, {
    provider: 'https://api.trongrid.io',
    apiKey: process.env.TRONGRID_API_KEY,
  })

  server.registerWallet('arbitrum', WalletManagerEvmERC4337, {
    provider: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
    bundler: process.env.CANDIDE_BUNDLER_URL!,
    paymaster: process.env.CANDIDE_PAYMASTER_URL!,
  })

  // Enable pricing tools (rates endpoint)
  server.usePricing()

  // Expose all standard wallet + pricing MCP tools
  server.registerTools([...WALLET_TOOLS, ...PRICING_TOOLS])

  // Start the MCP server over stdio (standard for OpenClaw / Claude Desktop)
  await server.start()

  console.error('[MCP] RemitAgent MCP server started — listening on stdio')
}

startMcpServer().catch((err) => {
  console.error('[MCP] Fatal:', err)
  process.exit(1)
})
