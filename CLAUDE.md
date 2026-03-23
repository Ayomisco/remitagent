# RemitAgent — Claude Project Context

## What This Is
AI-powered cross-border USDt remittance Telegram bot. Hackathon Galáctica: WDK Edition 1.
Track: 🤖 Agent Wallets (WDK / OpenClaw and Agents Integration)
GitHub: https://github.com/Ayomisco/remitagent

## Deployment
- **Hosting:** Railway (Dockerfile: node:20-slim — NOT alpine, sodium-native has no musl prebuilt)
- **Database:** Neon PostgreSQL (strips `channel_binding` and `sslmode` params before passing to pg Pool)
- **Redis:** Railway Redis (in-memory fallback when REDIS_URL not set)
- **Bot mode:** Webhook (WEBHOOK_URL must include https://) in prod, polling in dev
- **Demo wallet:** TCFz6SZtpmkEzCLpPvi6UQsKqxbBkhAYyv (TRON, derived from master seed + user ID)

## Stack
- Node.js 20 + TypeScript (ES Modules, `moduleResolution: bundler`)
- Telegraf (Telegram bot)
- Google Gemini 1.5 Flash (`@google/generative-ai`) — NLP intent parsing + conversational AI
- Tether WDK: `@tetherto/wdk`, `@tetherto/wdk-wallet-tron`, `@tetherto/wdk-protocol-fiat-moonpay`
- TRON as primary chain, Arbitrum optional (needs Candide BUNDLER_URL + PAYMASTER_URL)
- Express.js (webhook + /health endpoint for Railway healthcheck)
- ioredis + pg (node-postgres)

## Critical WDK API Rules
- USDt is a TOKEN — always use `account.transfer({ token, recipient, amount })` NOT `account.sendTransaction()`
- TRON USDT contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- Arbitrum USDT contract: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
- Token balance: `account.getTokenBalance(contractAddress)` NOT `account.getBalance()` (that returns native TRX)
- TronGasfreeWalletConfig requires 7 fields (undocumented) — using `wdk-wallet-tron` (standard) for demo
- MoonPayProtocol: `getProtocol()` does NOT exist on WdkManager — build URL directly instead

## Wallet Derivation
Each user gets a deterministic BIP-44 wallet:
`MASTER_SEED_PHRASE + SHA256(telegram_user_id) % 1_000_000 → account index → address`
No private keys stored in DB. Wallets reconstructed on demand.

## Key Source Files
- `src/wallet/wdk.ts` — WDK singleton, registers TRON + optional Arbitrum + optional MoonPay
- `src/wallet/userWallet.ts` — per-user wallet derivation + balance
- `src/wallet/transfer.ts` — sendUSDt() using account.transfer()
- `src/agent/parser.ts` — Gemini NLP intent parsing + generateChatReply()
- `src/agent/memory.ts` — conversation history in Redis (20 msgs, 1hr TTL)
- `src/agent/fsm.ts` — Redis FSM for multi-step transfer flow (5min TTL)
- `src/agent/planner.ts` — rate aggregation (CoinGecko, Binance P2P, OpenExchangeRates, Yellowcard)
- `src/db/postgres.ts` — Neon pool (strips unsupported URL params)
- `src/db/redis.ts` — ioredis + MemoryStore fallback
- `src/index.ts` — bot setup, message router, always starts HTTP server

## Agent Flow
1. User sends free text → regex fast-path → Gemini fallback → ParsedIntent
2. FSM state check (active conversation?) → route to handler
3. `send` → planner (rate agg) → FSM enter_recipient → FSM confirm → executor → WDK transfer
4. `chat`/`unknown` → getHistory() → generateChatReply(message, history) → appendHistory()
5. Transfer outcome written to conversation memory (TX hash, amount, recipient)

## MoonPay
- Test keys in use: pk_test_ZXWd50Gh44X9CtkPxIih3yUC8VoTLCl6
- Nigeria region blocked on MoonPay test mode — use Bybit USDT TRC-20 withdrawal for demo funding
- URL signed with HMAC-SHA256 of the query string using secret key

## Known Issues / Decisions Made
- Alpine → Debian: sodium-native (WDK dep) has no linux-x64-musl prebuilt
- wdk-wallet-tron-gasfree needs undocumented gasfree service credentials → using wdk-wallet-tron
- `@tetherto/wdk-mcp-toolkit` does not exist on npm — stub only
- WEBHOOK_URL env var must include `https://` prefix (auto-prefixed in code now)
- Gemini API key must be set in Railway Variables or all chat falls to canned replies
- Conversational AI: full history context (last 20 msgs), unrestricted topics, Gemini 1.5 Flash

## Environment Variables (all must be set in Railway)
- TELEGRAM_BOT_TOKEN, MASTER_SEED_PHRASE, WDK_SEED (same as MASTER_SEED_PHRASE)
- GEMINI_API_KEY — required for NLP and conversational AI
- DATABASE_URL — Neon PostgreSQL connection string
- REDIS_URL — Railway Redis
- WEBHOOK_URL — https://your-railway-url (must have https://)
- MOONPAY_API_KEY, MOONPAY_SECRET_KEY, MOONPAY_WEBHOOK_KEY
- NODE_ENV=production, PORT=3000
