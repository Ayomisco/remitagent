import type { Context } from 'telegraf'

const HELP_TEXT = `ℹ️ *RemitAgent Help*

*Send money:*
\`Send $200 to Maria in Mexico\`
\`Transfer £300 to my mum in Lagos\`
\`Send 50 USDT to TRX1abc...xyz\`

*Commands:*
/balance — check your USDt balance + address
/history — last 10 transfers
/deposit — add funds via MoonPay
/contacts — saved recipients
/help — this message

*How it works:*
1. Tell me what you want to send
2. I'll show you the best rate + fee breakdown
3. Confirm with *CONFIRM* — done in <60 seconds

*Fees:* <0.5% (vs Western Union ~8.5%)
*Chains:* TRON (default, cheapest) · Arbitrum

*Support:* @remit\\_agent\\_support`

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' })
}
