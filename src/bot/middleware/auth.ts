import type { Context, MiddlewareFn } from 'telegraf'
import { ensureUserRecord } from '../../wallet/userWallet.js'

export const authMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  if (ctx.from) {
    await ensureUserRecord(
      String(ctx.from.id),
      ctx.from.username,
      ctx.from.first_name,
    ).catch(() => {}) // non-blocking
  }
  return next()
}
