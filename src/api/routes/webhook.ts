import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { Telegraf } from 'telegraf'

export function createWebhookRouter(bot: Telegraf): Router {
  const router = createRouter()

  router.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res)
  })

  return router
}
