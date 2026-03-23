// Country flag map for common destinations
const FLAGS: Record<string, string> = {
  nigeria: '🇳🇬', brazil: '🇧🇷', mexico: '🇲🇽', ghana: '🇬🇭', kenya: '🇰🇪',
  india: '🇮🇳', philippines: '🇵🇭', indonesia: '🇮🇩', pakistan: '🇵🇰',
  'united states': '🇺🇸', uk: '🇬🇧', 'united kingdom': '🇬🇧',
  canada: '🇨🇦', germany: '🇩🇪', france: '🇫🇷', spain: '🇪🇸',
  china: '🇨🇳', japan: '🇯🇵', 'south africa': '🇿🇦', egypt: '🇪🇬',
  ethiopia: '🇪🇹', tanzania: '🇹🇿', uganda: '🇺🇬', senegal: '🇸🇳',
  colombia: '🇨🇴', venezuela: '🇻🇪', argentina: '🇦🇷', peru: '🇵🇪',
}

export function getFlag(country?: string): string {
  if (!country) return '🌍'
  return FLAGS[country.toLowerCase()] ?? '🌍'
}

export function welcomeMessage(firstName?: string): string {
  const name = firstName ? `, ${firstName}` : ''
  return `Hey${name}! 👋 I'm *RemitAgent* — your personal money transfer assistant.

I can send money anywhere in the world for you, fast and cheap. Just tell me what you need:

💬 "Send $200 to João in Brazil"
💬 "Transfer £300 to my mum in Lagos"
💬 "I want to send money home"

Under 0.5% fee. Under 60 seconds. No bank needed.

/balance — your wallet
/deposit — add funds
/help — how it works`
}

export function balanceMessage(usdt: number, address: string, chain: string): string {
  const hasBalance = usdt > 0
  return hasBalance
    ? `💰 You've got *${usdt.toFixed(2)} USDt* in your wallet.

Chain: ${chain.toUpperCase()}
Address: \`${address}\`

Ready to send? Just say: "Send $50 to someone"`
    : `Your wallet is empty right now.

Address: \`${address}\`

Add funds with /deposit, then you're good to go.`
}

export function transferSummaryMessage(params: {
  amount: number
  fromCurrency: string
  usdtAmount: number
  recipient: string
  recipientCountry?: string
  recipientGets?: string
  bestSource: string
  delivery: string
  needsAddress: boolean
  resolvedFrom?: string
}): string {
  const {
    amount, fromCurrency, usdtAmount, recipient, recipientCountry,
    recipientGets, delivery, needsAddress, resolvedFrom,
  } = params

  const flag = getFlag(recipientCountry)
  const recipientLine = recipientCountry
    ? `${recipient} in ${recipientCountry} ${flag}`
    : recipient

  const resolvedNote = resolvedFrom ? ` _(saved contact)_` : ''

  return `Got it 👍

Sending *${amount} ${fromCurrency}* → *${usdtAmount.toFixed(2)} USDt* to ${recipientLine}${resolvedNote}

${recipientGets ? `They receive: ~${recipientGets}\n` : ''}Fee: <0.5% _(vs 8.5% Western Union)_
Arrives: ${delivery}

${needsAddress
  ? `⚠️ What's ${recipient}'s wallet address? _(TRON starts with T, Arbitrum starts with 0x)_`
  : `Reply *CONFIRM* to send or *CANCEL* to abort.`}`
}

export function recipientConfirmedMessage(address: string, usdtAmount: number): string {
  return `Perfect. Here's the final summary 👇

Recipient: \`${address}\`
Amount: *${usdtAmount.toFixed(2)} USDt*

Takes less than 30 seconds once confirmed.

Reply *CONFIRM* to send or *CANCEL* to abort.`
}

export function processingMessage(): string {
  return '⚡ On it — sending now...'
}

export function transferCompleteMessage(params: {
  usdtAmount: number
  txHash: string
  explorerUrl: string
}): string {
  return `✅ *Done!* ${params.usdtAmount.toFixed(2)} USDt sent.

TX: \`${params.txHash}\`
[View on TronScan](${params.explorerUrl})

It's on-chain. Your recipient should have it within seconds.`
}

export function cancelMessage(): string {
  return "No problem — transfer cancelled. Just say the word whenever you're ready to try again."
}

export function errorMessage(err: string): string {
  // Human-friendly error rewriting
  if (err.toLowerCase().includes('insufficient')) {
    const match = err.match(/need ([\d.]+)/)
    const need = match ? ` You need ${match[1]} USDt.` : ''
    return `Your balance is too low for this transfer.${need}\n\nAdd funds with /deposit, then try again.`
  }
  if (err.toLowerCase().includes('invalid address')) {
    return `Hmm, that address doesn't look right. TRON addresses start with T, Arbitrum with 0x. Want to try again?`
  }
  return `Something went wrong on our end — ${err}\n\nGive it another shot or type /help.`
}

export function historyMessage(transfers: Array<{
  amount_usdt: string
  recipient_address: string
  chain: string
  status: string
  tx_hash?: string
  created_at: Date
}>): string {
  if (transfers.length === 0) {
    return "No transfers yet — you're all clear. Want to send someone money now?"
  }

  const lines = transfers.map((t, i) => {
    const date = new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const status = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳'
    const addr = `${t.recipient_address.slice(0, 6)}...${t.recipient_address.slice(-4)}`
    const amount = parseFloat(t.amount_usdt).toFixed(2)
    return `${i + 1}. ${status} *${amount} USDt* → \`${addr}\` — ${date}`
  })

  return `Here are your last ${transfers.length} transfer${transfers.length > 1 ? 's' : ''} 👇\n\n${lines.join('\n')}`
}

export function sessionExpiredMessage(): string {
  return "Looks like that session timed out. No worries — just start again whenever you're ready."
}

export function savedContactMessage(name: string): string {
  return `💾 Saved ${name} as a contact — next time just say "Send $X to ${name}" and we'll skip straight to confirm.`
}
