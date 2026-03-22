# RemitAgent 🌍💸

> "Send $200 to João in Brazil" → Done. Under $0.50 fee. Under 60 seconds.

AI-powered cross-border remittances using Tether WDK. Built for **Hackathon Galáctica: WDK Edition 1**.

**Track:** 🤖 Agent Wallets (WDK / OpenClaw and Agents Integration)

---

## What It Does

Tell RemitAgent in plain English what you want to send. It handles everything else.

```
You:  Send $200 to Maria in Mexico
Bot:  💸 Transfer Summary
      From: $200 USD → 200 USDt
      Fee: <0.5% (vs 8.5% Western Union)
      Best rate: CoinGecko
      Delivery: < 1 minute
      ⚠️ Please send Maria's wallet address.

You:  TRXabc123...xyz
Bot:  Got it. Reply CONFIRM to send or CANCEL to abort.

You:  CONFIRM
Bot:  ✅ Transfer Complete!
      Amount: 200 USDt
      TX: abc123... [View on TronScan]
      💾 Saved Maria as a contact for next time.
```

**Next time:**
```
You:  Send $50 to Maria
Bot:  💸 From $50 USD → 50 USDt → Maria (from saved contact)
      Reply CONFIRM to send.
```

Zero human input after initial setup. The agent handles rates, routing, and contact memory autonomously.

---

## Why It Wins

| | Western Union | Wise | **RemitAgent** |
|---|---|---|---|
| Fee | 8.5% | 0.5–2% | **<0.5%** |
| Speed | 1–5 days | 1–2 days | **< 60 seconds** |
| Bank needed | Yes | Yes | **No** |
| Self-custodial | No | No | **Yes (WDK)** |
| Gas tokens needed | N/A | N/A | **No (gasfree)** |

**$900B+ annual remittance volume. $63B/year extracted in fees. RemitAgent fixes this.**

---

## Architecture

```
User (Telegram)
    │ natural language message
    ▼
NLP Parser (Gemini 1.5 Flash)
    │ regex fast-path → Gemini fallback
    │ intent: { type, amount, currency, recipient }
    ▼
Rate Aggregator (Redis-cached 60s)
    │ CoinGecko · Binance P2P · OpenExchangeRates · Yellowcard
    │ picks best rate automatically
    ▼
Agent FSM (Redis)
    │ multi-step: enter_recipient → confirm_transfer → execute
    │ auto-resolves saved contacts, auto-saves new ones
    ▼
Transfer Executor
    │ account.transfer({ token: USDT_TRC20, recipient, amount })
    ▼
Tether WDK — TRON Gasfree
    │ @tetherto/wdk-wallet-tron-gasfree
    │ zero TRX needed · ~$0.01 per tx
    ▼
TRON Blockchain → Recipient Wallet
```

### Agent Autonomy

The agent operates with minimal human input:

1. **Auto-parses intent** from natural language (Gemini + regex fast-path)
2. **Auto-aggregates rates** from 4 sources, picks best automatically
3. **Auto-resolves saved contacts** — returning users skip the address step entirely
4. **Auto-saves new recipients** silently after first successful transfer
5. **Auto-selects cheapest chain** — TRON for normal amounts, Arbitrum for large amounts
6. **Auto-retries failed rate sources** — graceful degradation if one API is down

The only human steps: type the message → type CONFIRM. Everything else is autonomous.

---

## WDK Integration

### Modules Used

| Module | Purpose |
|---|---|
| `@tetherto/wdk` | Core orchestrator, BIP-44 HD wallet derivation |
| `@tetherto/wdk-wallet-tron-gasfree` | TRON USDt transfers — zero TRX gas required |
| `@tetherto/wdk-wallet-evm-erc-4337` | Arbitrum USDt — gasless via ERC-4337 paymaster |
| `@tetherto/wdk-protocol-fiat-moonpay` | Fiat → USDt on-ramp via MoonPay |

### Key Design: No Private Key Storage

Each user gets a deterministic self-custodial wallet derived from:
```
MASTER_SEED_PHRASE + SHA256(telegram_user_id) → BIP-44 account index
```
No private keys ever stored in the database. Wallets reconstructed on demand.

### Token Transfers (not native currency)

USDt is a TRC-20 token. We use the correct WDK API:
```typescript
// ✅ Correct — sends TRC-20 token
await account.transfer({
  token: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT TRC-20
  recipient: recipientAddress,
  amount: BigInt(amountUsdt * 1_000_000)
})

// ❌ Wrong — this sends native TRX
await account.sendTransaction({ to, value })
```

### OpenClaw / MCP Integration

RemitAgent exposes its wallet operations as an MCP-compatible agent via the community `wdk-mcp` server. To connect with OpenClaw:

```bash
# 1. Install community wdk-mcp server
git clone https://github.com/dieselftw/wdk-mcp
cd wdk-mcp && npm install

# 2. Run with RemitAgent's seed
WDK_SEED="your seed phrase" npm start

# 3. Point OpenClaw at the MCP server
# OpenClaw → Settings → MCP → add localhost endpoint
```

The Telegram bot itself serves the same architectural role as OpenClaw — it's a conversational agent interface that routes natural language to WDK wallet operations.

---

## Setup

### Prerequisites
- Node.js 20+
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))
- PostgreSQL database ([Neon](https://neon.tech) free tier works)
- Redis (optional — falls back to in-memory for development)

### Local Development

```bash
git clone https://github.com/Ayomisco/remitagent
cd remitagent
npm install

# Copy and fill environment variables
cp .env.example .env
# Required: TELEGRAM_BOT_TOKEN, MASTER_SEED_PHRASE, GEMINI_API_KEY, DATABASE_URL

# Generate a seed phrase
node -e "import('@tetherto/wdk').then(m => console.log(m.default.getRandomSeedPhrase()))"

# Run DB migration
npm run db:migrate

# Start bot (polling mode — no webhook needed)
npm run dev
```

### Production (Railway)

```bash
# 1. Push to GitHub
git push

# 2. Go to railway.app → New Project → Deploy from GitHub

# 3. Add env vars in Railway dashboard (all values from .env)

# 4. Railway gives you a URL like: https://remit-agent.up.railway.app
#    Set WEBHOOK_URL=https://remit-agent.up.railway.app in Railway vars

# 5. Railway auto-deploys → bot is live
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | From [@BotFather](https://t.me/BotFather) |
| `MASTER_SEED_PHRASE` | ✅ | BIP-39 12-word seed (generate with WDK) |
| `GEMINI_API_KEY` | ✅ | Google AI Studio — free tier |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | Optional | Falls back to in-memory |
| `TRONGRID_API_KEY` | Optional | Public endpoint works without it |
| `MOONPAY_API_KEY` | Optional | Enables `/deposit` fiat on-ramp |

---

## Supported Commands

| Command | Description |
|---|---|
| `/start` | Onboarding + welcome message |
| `/balance` | Check USDt wallet balance + address |
| `/history` | Last 10 transfers |
| `/deposit` | Generate MoonPay fiat on-ramp link |
| `/help` | Full command reference |
| Free text | `"Send $50 to João in Brazil"` etc. |

---

## Economic Model

- **Fee:** 0.5% per transfer (vs 7–8.5% incumbents)
- **Settlement:** USDt TRC-20 on TRON (~$0.01/tx gas, sponsored by gasfree service)
- **No custodial risk:** Funds go directly wallet-to-wallet, never through RemitAgent
- **Revenue at scale:** $1M daily volume → $5K/day at 0.5%

---

## Known Limitations

- Recipients must have a crypto wallet address (TRON or Arbitrum)
- No fiat off-ramp built in (relies on recipient exchanging USDt to local currency via P2P)
- MoonPay on-ramp requires KYC for large amounts
- `@tetherto/wdk-mcp-toolkit` not yet published — OpenClaw direct integration pending

---

## Tech Stack

- **Runtime:** Node.js 20 + TypeScript + ES Modules
- **Bot:** Telegraf (Telegram Bot API)
- **AI:** Google Gemini 1.5 Flash (NLP parsing)
- **Wallets:** Tether WDK — TRON gasfree + Arbitrum ERC-4337
- **Rates:** CoinGecko, Binance P2P, OpenExchangeRates, Yellowcard
- **DB:** PostgreSQL (Neon) + Redis (session state, rate cache)
- **Hosting:** Railway

---

Built with Tether WDK for **Hackathon Galáctica: WDK Edition 1** 🚀
