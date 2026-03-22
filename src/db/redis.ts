import Redis from 'ioredis'

// ── In-memory fallback (used when REDIS_URL is not set) ────────────────────
class MemoryStore {
  private store = new Map<string, { value: string; expiresAt?: number }>()

  private isExpired(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return true
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return true
    }
    return false
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null
    return this.store.get(key)?.value ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, { value })
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    const val = await this.get(key)
    const next = (parseInt(val ?? '0') || 0) + 1
    const entry = this.store.get(key)
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt })
    return next
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) this.store.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 })
  }

  async ping(): Promise<string> { return 'PONG' }
}

// ── Client singleton ───────────────────────────────────────────────────────
type RedisLike = Pick<Redis, 'get' | 'set' | 'del' | 'incr' | 'expire' | 'ping'> & {
  setex(key: string, seconds: number, value: string): Promise<any>
}

let client: RedisLike | null = null
let usingMemory = false

export function getRedis(): RedisLike {
  if (client) return client

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not set — using in-memory store (not suitable for multi-process production)')
    usingMemory = true
    client = new MemoryStore() as unknown as RedisLike
    return client
  }

  const ioredis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true })
  ioredis.on('error', (err) => console.error('[Redis] Error:', err))
  ioredis.on('connect', () => console.log('[Redis] Connected'))
  client = ioredis
  return client
}

export async function connectRedis(): Promise<void> {
  const c = getRedis()
  if (!usingMemory) await (c as Redis).connect().catch(() => {})
  console.log(`[Redis] Ready (${usingMemory ? 'in-memory' : 'Redis'})`)
}

// Convenience proxy: `redis.get(...)` instead of `getRedis().get(...)`
export const redis = new Proxy({} as RedisLike, {
  get(_target, prop) {
    const c = getRedis()
    const value = (c as any)[prop]
    return typeof value === 'function' ? value.bind(c) : value
  },
})
