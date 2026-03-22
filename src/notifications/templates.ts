export function welcomeMessage(firstName?: string): string {
  const name = firstName ? ` ${firstName}` : ''
  return `👋 Welcome to *RemitAgent*${name}!

Send money anywhere in the world using USDt — as easy as sending a text.

*Try these commands:*
💬 \`Send $200 to Maria in Mexico\`
💬 \`Transfer £300 to my mum in Lagos\`
💬 \`Send 50 USDT to TRX1abc...xyz\`

/balance — check your wallet
/history — recent transfers
/deposit — add funds (MoonPay)
/help — FAQ`
}

export function balanceMessage(usdt: number, address: string, chain: string): string {
  return `💰 *Your Wallet*

Balance: \`${usdt.toFixed(2)} USDt\`
Chain: ${chain.toUpperCase()}
Address: \`${address}\`

Send money: \`Send $100 to someone\`
Add funds: /deposit`
}

export function transferSummaryMessage(params: {
  amount: number
  fromCurrency: string
  usdtAmount: number
  recipient: string
  recipientGets?: string
  bestSource: string
  delivery: string
  needsAddress: boolean
  resolvedFrom?: string
}): string {
  const {
    amount, fromCurrency, usdtAmount, recipient, recipientGets,
    bestSource, delivery, needsAddress, resolvedFrom,
  } = params

  return `💸 *Transfer Summary*

From: ${amount} ${fromCurrency}
Sending: ${usdtAmount.toFixed(2)} USDt
${recipientGets ? `Recipient gets: ~${recipientGets}` : ''}
To: ${recipient}${resolvedFrom ? ` _(from ${resolvedFrom})_` : ''}
Best rate: ${bestSource}
Fee: <0.5% *(vs ~8.5% Western Union)*
Delivery: ${delivery}

${needsAddress ? '⚠️ *Please send me the recipient\'s TRON or Arbitrum wallet address.*' : ''}

Reply *CONFIRM* to send or *CANCEL* to abort.`.trim()
}

export function transferCompleteMessage(params: {
  usdtAmount: number
  txHash: string
  explorerUrl: string
}): string {
  return `✅ *Transfer Complete!*

Amount: \`${params.usdtAmount.toFixed(2)} USDt\`
TX: \`${params.txHash}\`
[View on Explorer](${params.explorerUrl})

Your recipient has been notified.`
}

export function errorMessage(err: string): string {
  return `❌ *Transfer failed*

${err}

Please try again or type /help.`
}

export function historyMessage(transfers: Array<{
  amount_usdt: string
  recipient_address: string
  chain: string
  status: string
  tx_hash?: string
  created_at: Date
}>): string {
  if (transfers.length === 0) return '📋 No transfers yet. Send money with: `Send $50 to someone`'

  const lines = transfers.map((t, i) => {
    const date = new Date(t.created_at).toLocaleDateString()
    const status = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳'
    const addr = `${t.recipient_address.slice(0, 8)}...`
    return `${i + 1}. ${status} ${parseFloat(t.amount_usdt).toFixed(2)} USDt → \`${addr}\` (${t.chain}) — ${date}`
  })

  return `📋 *Recent Transfers*\n\n${lines.join('\n')}`
}
