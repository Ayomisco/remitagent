import type { Telegraf } from 'telegraf'

let botRef: Telegraf | null = null

export function registerBot(bot: Telegraf): void {
  botRef = bot
}

/**
 * Push a notification to a Telegram user by their telegram_id.
 * Used for async notifications (e.g. recipient gets notified when funds arrive).
 */
export async function notify(telegramId: string, message: string): Promise<void> {
  if (!botRef) return
  try {
    await botRef.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' })
  } catch (err) {
    console.error(`[Notify] Failed to notify ${telegramId}:`, err)
  }
}
