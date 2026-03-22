import 'dotenv/config'
import { Telegraf } from 'telegraf'
import { createServer } from './api/server.js'
import { connectRedis } from './db/redis.js'
import { connectPostgres } from './db/postgres.js'
import { getWDK } from './wallet/wdk.js'
import { registerBot } from './notifications/sender.js'
import { authMiddleware } from './bot/middleware/auth.js'
import { rateLimitMiddleware } from './bot/middleware/rateLimit.js'
import { handleStart } from './bot/handlers/start.js'
import { handleBalance } from './bot/handlers/balance.js'
import { handleHistory } from './bot/handlers/history.js'
import { handleHelp } from './bot/handlers/help.js'
import { handleDeposit } from './bot/handlers/deposit.js'
import { handleSendFlow, handleActiveConversation } from './bot/handlers/send.js'
import { parseIntent } from './agent/parser.js'
import { getState } from './agent/fsm.js'

function checkRequiredEnv() {
  const required = ['TELEGRAM_BOT_TOKEN', 'MASTER_SEED_PHRASE', 'DATABASE_URL']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error('[Fatal] Missing required environment variables:', missing.join(', '))
    console.error('Set them in Railway dashboard → Variables tab, then redeploy.')
    process.exit(1)
  }
}

async function main() {
  checkRequiredEnv()

  // ── Connect infrastructure ──────────────────────────────────────────────
  await connectRedis()
  await connectPostgres()

  // Warm up WDK singleton (validates seed phrase at startup)
  await getWDK()
  console.log('[WDK] Initialized')

  // ── Set up Telegram bot ─────────────────────────────────────────────────
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')

  const bot = new Telegraf(token)
  registerBot(bot)

  // Global middleware
  bot.use(authMiddleware)
  bot.use(rateLimitMiddleware)

  // Commands
  bot.command('start', handleStart)
  bot.command('balance', handleBalance)
  bot.command('history', handleHistory)
  bot.command('help', handleHelp)
  bot.command('deposit', handleDeposit)

  // Free-text message router
  bot.on('text', async (ctx) => {
    const message = ctx.message.text
    const userId = String(ctx.from.id)

    // Skip bot commands that fall through here
    if (message.startsWith('/')) return

    // Check for active conversation state first
    const state = await getState(userId)
    if (state) {
      await handleActiveConversation(ctx, message)
      return
    }

    // Parse fresh intent
    const intent = await parseIntent(message)

    switch (intent.type) {
      case 'send':
        await handleSendFlow(ctx, message)
        break
      case 'balance':
        await handleBalance(ctx)
        break
      case 'history':
        await handleHistory(ctx)
        break
      case 'help':
        await handleHelp(ctx)
        break
      default:
        await ctx.reply(
          "I didn't understand that. Try:\n`Send $100 to someone`\n\nOr type /help for all commands.",
          { parse_mode: 'Markdown' },
        )
    }
  })

  // Error handler
  bot.catch((err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err)
    ctx.reply('❌ Something went wrong. Please try again.').catch(() => {})
  })

  // ── Start ───────────────────────────────────────────────────────────────
  const webhookUrl = process.env.WEBHOOK_URL
  const port = parseInt(process.env.PORT ?? '3000', 10)

  // Always start HTTP server so Railway healthcheck on /health passes
  const server = createServer(bot)
  server.listen(port, () => {
    console.log(`[Server] RemitAgent running on port ${port}`)
  })

  if (webhookUrl) {
    // Ensure URL has https:// prefix (Telegram requires HTTPS)
    const fullWebhookUrl = webhookUrl.startsWith('http') ? webhookUrl : `https://${webhookUrl}`
    await bot.telegram.setWebhook(`${fullWebhookUrl}/webhook`)
    console.log(`[Bot] Webhook set to ${fullWebhookUrl}/webhook`)
  } else {
    // Development: polling mode (also works in Railway without WEBHOOK_URL)
    await bot.launch()
    console.log('[Bot] RemitAgent started (polling mode)')

    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
  }
}

main().catch((err) => {
  console.error('[Fatal]', err)
  process.exit(1)
})
