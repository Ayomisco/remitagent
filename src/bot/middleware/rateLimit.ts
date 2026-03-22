import type { Context, MiddlewareFn } from 'telegraf'
import { redis } from '../../db/redis.js'

const MAX_REQUESTS = 10
const WINDOW_SECONDS = 60

export const rateLimitMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id
  if (!userId) return next()

  const key = `ratelimit:${userId}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, WINDOW_SECONDS)

  if (count > MAX_REQUESTS) {
    await ctx.reply('⚠️ Too many requests. Please wait a minute.')
    return
  }

  return next()
}
