import express from 'express'
import type { Telegraf } from 'telegraf'
import healthRouter from './routes/health.js'
import { createWebhookRouter } from './routes/webhook.js'
import { corsMiddleware } from './middleware/cors.js'

export function createServer(bot: Telegraf): express.Application {
  const app = express()

  app.use(corsMiddleware)
  app.use(express.json())

  app.use(healthRouter)
  app.use(createWebhookRouter(bot))

  return app
}
