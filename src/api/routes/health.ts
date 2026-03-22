import type { Router } from 'express'
import { Router as createRouter } from 'express'
import { getPool } from '../../db/postgres.js'
import { redis } from '../../db/redis.js'

const router: Router = createRouter()

router.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {}

  try {
    await getPool().query('SELECT 1')
    checks.postgres = 'ok'
  } catch {
    checks.postgres = 'error'
  }

  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks })
})

export default router
