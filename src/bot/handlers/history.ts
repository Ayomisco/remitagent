import type { Context } from 'telegraf'
import { db } from '../../db/postgres.js'
import { historyMessage } from '../../notifications/templates.js'

export async function handleHistory(ctx: Context): Promise<void> {
  const userId = String(ctx.from!.id)

  const { rows } = await db.query(
    `SELECT amount_usdt, recipient_address, chain, status, tx_hash, created_at
     FROM transfers
     WHERE sender_telegram_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId],
  )

  await ctx.reply(historyMessage(rows), { parse_mode: 'Markdown' })
}
