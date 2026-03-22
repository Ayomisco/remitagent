import { db } from '../db/postgres.js'

export interface Recipient {
  id: number
  name: string
  walletAddress?: string
  phone?: string
  country?: string
  preferredChain: 'tron' | 'arbitrum'
}

export async function saveRecipient(
  ownerTelegramId: string,
  data: {
    name: string
    walletAddress?: string
    phone?: string
    country?: string
    preferredChain?: 'tron' | 'arbitrum'
  },
): Promise<Recipient> {
  const { rows } = await db.query(
    `INSERT INTO recipients (owner_telegram_id, name, wallet_address, phone, country, preferred_chain)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      ownerTelegramId,
      data.name,
      data.walletAddress ?? null,
      data.phone ?? null,
      data.country ?? null,
      data.preferredChain ?? 'tron',
    ],
  )
  return rows[0]
}

export async function findRecipient(
  ownerTelegramId: string,
  nameOrAddress: string,
): Promise<Recipient | null> {
  const { rows } = await db.query(
    `SELECT * FROM recipients
     WHERE owner_telegram_id = $1
       AND (LOWER(name) = LOWER($2) OR wallet_address = $2 OR phone = $2)
     LIMIT 1`,
    [ownerTelegramId, nameOrAddress],
  )
  return rows[0] ?? null
}

export async function listRecipients(ownerTelegramId: string): Promise<Recipient[]> {
  const { rows } = await db.query(
    `SELECT * FROM recipients WHERE owner_telegram_id = $1 ORDER BY name`,
    [ownerTelegramId],
  )
  return rows
}
