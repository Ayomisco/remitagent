import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    const rawUrl = process.env.DATABASE_URL ?? ''

    // Strip params pg driver doesn't support (channel_binding is a Neon-added param)
    const connectionString = rawUrl
      .replace(/[&?]channel_binding=[^&]*/g, '')
      .replace(/[&?]sslmode=[^&]*/g, '')  // we set ssl explicitly below

    // Neon and most cloud Postgres providers require SSL
    const sslRequired = rawUrl.includes('neon.tech') ||
                        rawUrl.includes('railway.app') ||
                        rawUrl.includes('sslmode=require') ||
                        process.env.NODE_ENV === 'production'

    pool = new Pool({
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on('error', (err) => console.error('[Postgres] Pool error:', err))
  }
  return pool
}

export async function connectPostgres(): Promise<void> {
  const client = await getPool().connect()
  console.log('[Postgres] Connected')
  client.release()
}

export const db = {
  query: (text: string, params?: any[]) => getPool().query(text, params),
  getClient: () => getPool().connect(),
}
