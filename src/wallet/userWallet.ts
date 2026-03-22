import crypto from 'crypto'
import type WDK from '@tetherto/wdk'
import { getWDK } from './wdk.js'
import { db } from '../db/postgres.js'

export type Chain = 'tron' | 'arbitrum'

function getUserWalletIndex(telegramUserId: string): number {
  const hash = crypto.createHash('sha256').update(telegramUserId).digest('hex')
  // Deterministic index 0–999999 — no private keys stored, just derived on demand
  return parseInt(hash.slice(0, 8), 16) % 1_000_000
}

export async function getUserWallet(
  telegramUserId: string,
  chain: Chain = 'tron',
): Promise<{ account: Awaited<ReturnType<WDK['getAccount']>>; address: string; accountIndex: number }> {
  const wdk = await getWDK()
  const accountIndex = getUserWalletIndex(telegramUserId)
  const account = await wdk.getAccount(chain, accountIndex)
  const address = await account.getAddress()

  await db.query(
    `INSERT INTO users (telegram_id, ${chain}_address, wallet_index)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE
       SET ${chain}_address = EXCLUDED.${chain}_address,
           updated_at = NOW()`,
    [telegramUserId, address, accountIndex],
  )

  return { account, address, accountIndex }
}

// USDt contract addresses
const USDT_CONTRACTS: Record<Chain, string> = {
  tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
}

export async function getBalance(telegramUserId: string, chain: Chain = 'tron') {
  const { account, address } = await getUserWallet(telegramUserId, chain)
  // USDt is a token — use getTokenBalance(), not getBalance() (which is native currency)
  const rawBalance = await account.getTokenBalance(USDT_CONTRACTS[chain])
  const usdt = Number(rawBalance) / 1_000_000
  return { usdt, rawBalance, address, chain }
}

export async function ensureUserRecord(
  telegramUserId: string,
  username?: string,
  firstName?: string,
) {
  await db.query(
    `INSERT INTO users (telegram_id, username, first_name, wallet_index)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username = COALESCE(EXCLUDED.username, users.username),
           first_name = COALESCE(EXCLUDED.first_name, users.first_name),
           updated_at = NOW()`,
    [telegramUserId, username ?? null, firstName ?? null, getUserWalletIndex(telegramUserId)],
  )
}
