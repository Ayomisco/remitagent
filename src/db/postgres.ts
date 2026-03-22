import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
