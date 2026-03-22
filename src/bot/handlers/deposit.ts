import type { Context } from 'telegraf'
import { getFiatOnrampUrl } from '../../wallet/onramp.js'

export async function handleDeposit(ctx: Context): Promise<void> {
  const userId = String(ctx.from!.id)

  try {
    const { url, estimatedUsdt } = await getFiatOnrampUrl(userId, 50, 'usd')
    await ctx.reply(
      `💳 *Add Funds via MoonPay*\n\nBuy USDt with your debit/credit card:\n[Open MoonPay](${url})\n\n~${estimatedUsdt.toFixed(2)} USDt for $50 USD (after fees)\n\n_Funds arrive in your TRON wallet within 2–10 minutes._`,
      { parse_mode: 'Markdown' },
    )
  } catch (err) {
    await ctx.reply(`❌ Could not generate deposit link: ${(err as Error).message}`)
  }
}
