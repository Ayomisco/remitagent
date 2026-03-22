# RemitAgent — Demo Script (Judges)

**Target time:** 90 seconds
**What judges will see:** Natural language → real blockchain transaction → tx hash → explorer link

---

## Pre-Demo Setup (do this before judges arrive)

1. Fund the test sender wallet with 20 USDt on TRON (get address via `/balance`)
2. Have two phones / Telegram accounts ready: "Sender" and "Recipient"
3. Open TronScan in a browser tab: https://tronscan.org
4. Practice the flow 3x so it's smooth

---

## Demo Flow

### Step 1 — Open Telegram, message the bot

```
Sender: /start
```

**Bot replies:**
```
👋 Welcome to RemitAgent!

Send money anywhere in the world using USDt.

Try: "Send $200 to Maria in Mexico"
```

**Say to judges:** "No app download. No bank account. Just message it."

---

### Step 2 — Send money in plain English

```
Sender: Send $50 to João in Brazil
```

**Bot replies:**
```
⏳ Checking rates...

💸 Transfer Summary

From: $50 USD
Sending: 50.00 USDt
To: João
Best rate: CoinGecko
Fee: <0.5% (vs ~8.5% Western Union)
Delivery: < 1 minute

⚠️ Please send me João's TRON or Arbitrum wallet address.

Reply CONFIRM to send or CANCEL to abort.
```

**Say to judges:** "The AI parsed the intent, fetched live rates, and shows the fee comparison. Western Union charges 8.5% on this corridor. We charge 0.5%."

---

### Step 3 — Provide wallet address

```
Sender: TRX_RECIPIENT_ADDRESS_HERE
```

**Bot replies:**
```
Got it. Recipient: TRX...

Reply CONFIRM to send or CANCEL to abort.
```

---

### Step 4 — Confirm

```
Sender: CONFIRM
```

**Bot replies:**
```
⏳ Processing your transfer...
```

*(5–10 seconds pass)*

```
✅ Transfer Complete!

Amount: 50.00 USDt
TX: abc123def456...
View on Explorer: https://tronscan.org/#/transaction/abc123...
```

**Show judges:** Open the TronScan link in the browser. The transaction is real, on TRON mainnet.

---

### Step 5 — Check recipient received it

Switch to the second phone (recipient).

```
Recipient: /balance
```

**Bot replies:**
```
💰 Your Wallet

Balance: 50.00 USDt
Chain: TRON
Address: T...
```

**Say to judges:** "50 USDT arrived in under 60 seconds. No bank. No Western Union branch. No 8.5% fee. Self-custodial — we never hold their funds."

---

## Bonus Demo Points (if time allows)

### OpenClaw / MCP Integration
"The same wallet is also accessible via OpenClaw — an agent platform for autonomous AI agents. Any MCP-compatible client can call our wallet tools directly."

Show: start the MCP server, connect to OpenClaw or Claude Desktop, ask "What's my TRON balance?"

### Rate Comparison
```
Sender: Send £100 to my mum in Lagos
```
Shows Yellowcard rate (Africa-specific) alongside CoinGecko — best rate wins.

### Deposit Flow
```
Sender: /deposit
```
Opens MoonPay checkout — buy USDt with a debit card.

---

## Key Talking Points for Judges

| Metric | RemitAgent | Western Union |
|---|---|---|
| Fee | <0.5% | 8.5% |
| Speed | <60 seconds | 1–5 days |
| Bank needed | No | Yes |
| Self-custodial | Yes | No |
| Gas tokens needed | No | N/A |

**Market:** $900B+ annual remittance volume. $63B/year extracted in fees.
**WDK used:** TRON gasfree + ERC-4337 gasless + MoonPay fiat module + MCP toolkit
**Track:** Agent Wallets (WDK / OpenClaw and Agents Integration)

---

## If Something Goes Wrong

| Problem | Fix |
|---|---|
| "Insufficient balance" | Pre-fund the sender wallet before demo |
| Bot not responding | Check Railway logs, verify webhook is set |
| Rate fetch fails | CoinGecko is the fallback — Redis cache may have stale data |
| TX fails on TRON | Gasfree service might be down — switch to Arbitrum demo |
