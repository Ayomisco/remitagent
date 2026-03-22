import type { Context } from 'telegraf'
import { ensureUserRecord } from '../../wallet/userWallet.js'
import { welcomeMessage } from '../../notifications/templates.js'

export async function handleStart(ctx: Context): Promise<void> {
  const userId = String(ctx.from!.id)
  const username = ctx.from!.username
  const firstName = ctx.from!.first_name

  await ensureUserRecord(userId, username, firstName)
  await ctx.reply(welcomeMessage(firstName), { parse_mode: 'Markdown' })
}
