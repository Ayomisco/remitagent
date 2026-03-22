# RemitAgent — Architecture

## Overview

RemitAgent is an AI-powered cross-border remittance agent. Users send a plain-English message ("Send $200 to João in Brazil") and the agent handles everything: NLP parsing, rate aggregation, USDt conversion via Tether WDK, and blockchain transfer.

```
User (Telegram / OpenClaw / WhatsApp)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   AGENT LAYER (Node.js)                     │
│                                                             │
│  NLP Parser (Gemini 1.5 Flash)                              │
│    → regex fast-path for common patterns                    │
│    → Gemini fallback for complex messages                   │
│                                                             │
│  FSM (Redis) — multi-step conversation state                │
│    enter_recipient → confirm_transfer → execute             │
│                                                             │
│  Rate Aggregator (Redis-cached 60s)                         │
│    CoinGecko · Binance P2P · OpenExchangeRates · Yellowcard │
│                                                             │
│  Transfer Executor                                          │
│    account.transfer({ token, recipient, amount })           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   TETHER WDK LAYER                          │
│                                                             │
│  @tetherto/wdk  (core orchestrator, BIP-44 HD wallets)      │
│                                                             │
│  TRON (primary)                                             │
│  @tetherto/wdk-wallet-tron-gasfree                          │
│    • USDT TRC-20 (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)      │
│    • Zero TRX needed — gas sponsored by gasfree service     │
│    • ~$0.01 per tx                                          │
│                                                             │
│  Arbitrum (secondary)                                       │
│  @tetherto/wdk-wallet-evm-erc4337                           │
│    • USDT ERC-20 (0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9)│
│    • Zero ETH needed — gas paid in USDt via paymaster       │
│                                                             │
│  @tetherto/wdk-protocol-fiat-moonpay                        │
│    • Fiat → USDt on-ramp via MoonPay                        │
│                                                             │
│  @tetherto/wdk-mcp-toolkit                                  │
│    • 35 MCP tools exposed for OpenClaw / Claude / Cursor    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   INFRASTRUCTURE                            │
│  Railway (Node.js server, auto-deploy from GitHub)          │
│  Postgres — users, transfers, recipients                    │
│  Redis — session FSM, rate cache (60s TTL)                  │
│  Express — Telegram webhook + /health endpoint              │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Wallet Derivation (No Private Key Storage)
Each user gets a deterministic HD wallet derived from:
```
MASTER_SEED_PHRASE + SHA256(telegram_user_id) → account index
```
No private keys are stored. Wallets are reconstructed on demand from the seed.

### Why TRON First
- Cheapest USDt transfers (~$0.01 per tx vs $1–5 on Ethereum)
- TRON gasfree module means zero TRX needed in the wallet
- Most P2P exchanges in Africa/Asia use TRC-20 USDT

### Why `account.transfer()` Not `account.sendTransaction()`
USDt is a token, not a native currency. `sendTransaction()` sends native TRX/ETH. `transfer()` sends TRC-20/ERC-20 tokens.

### OpenClaw / MCP Integration
The MCP server (`src/mcp/server.ts`) exposes 35+ wallet tools so OpenClaw (or Claude Desktop, Cursor, etc.) can autonomously:
- Check balances
- Send USDt
- Check rates
- View history

## File Structure

```
src/
├── index.ts              Entry point
├── agent/
│   ├── parser.ts         NLP: Gemini + regex fast-path
│   ├── planner.ts        Rate aggregation + USDt calculation
│   ├── executor.ts       Calls sendUSDt()
│   └── fsm.ts            Redis FSM for multi-step flows
├── wallet/
│   ├── wdk.ts            WDK singleton init
│   ├── userWallet.ts     HD wallet derivation per user
│   ├── transfer.ts       account.transfer() for USDt tokens
│   └── onramp.ts         MoonPay fiat on-ramp URLs
├── rates/
│   ├── aggregator.ts     Multi-source rate aggregation
│   └── sources/          CoinGecko, Binance, OXR, Yellowcard
├── bot/
│   ├── handlers/         start, send, balance, history, help, deposit
│   └── middleware/       auth, rate-limit
├── mcp/
│   └── server.ts         WDK MCP server for OpenClaw
├── api/
│   └── server.ts         Express: webhook + /health
├── db/
│   ├── postgres.ts
│   ├── redis.ts
│   └── migrations/
├── notifications/
│   ├── templates.ts      All bot message templates
│   └── sender.ts         Push notifications
└── recipients/
    ├── registry.ts       Save/find contacts
    └── resolver.ts       Resolve name/address to wallet
```
