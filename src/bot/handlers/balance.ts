import type { Context } from 'telegraf'
import { getBalance } from '../../wallet/userWallet.js'
import { balanceMessage } from '../../notifications/templates.js'

export async function handleBalance(ctx: Context): Promise<void> {
  const userId = String(ctx.from!.id)

  await ctx.reply('⏳ Fetching your balance...')

  try {
    const { usdt, address, chain } = await getBalance(userId, 'tron')
    await ctx.reply(balanceMessage(usdt, address, chain), { parse_mode: 'Markdown' })
  } catch (err) {
    await ctx.reply(`❌ Could not fetch balance: ${(err as Error).message}`)
  }
}
