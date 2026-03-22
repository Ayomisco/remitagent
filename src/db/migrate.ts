import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { connectPostgres, db } from './postgres.js'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  await connectPostgres()
  const sql = readFileSync(join(__dirname, 'migrations/001_init.sql'), 'utf-8')
  await db.query(sql)
  console.log('[Migrate] Schema applied successfully')
  process.exit(0)
}

migrate().catch((err) => {
  console.error('[Migrate] Failed:', err)
  process.exit(1)
})
