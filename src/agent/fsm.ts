import { redis } from '../db/redis.js'
import type { ParsedIntent } from './parser.js'
import type { RateQuote } from '../rates/aggregator.js'

export type FSMStep =
  | 'enter_recipient'    // waiting for wallet address / phone
  | 'confirm_transfer'   // waiting for CONFIRM / CANCEL
  | 'awaiting_payment'   // waiting for on-ramp payment (MoonPay)

export interface TransferState {
  step: FSMStep
  parsed: ParsedIntent
  quote: RateQuote & { usdtAmount: number }
  recipientAddress?: string
}

const STATE_TTL = 5 * 60 // 5 minutes

function key(userId: string): string {
  return `state:${userId}`
}

export async function getState(userId: string): Promise<TransferState | null> {
  const raw = await redis.get(key(userId))
  if (!raw) return null
  return JSON.parse(raw) as TransferState
}

export async function setState(userId: string, state: TransferState): Promise<void> {
  await redis.setex(key(userId), STATE_TTL, JSON.stringify(state))
}

export async function clearState(userId: string): Promise<void> {
  await redis.del(key(userId))
}

export async function updateState(
  userId: string,
  patch: Partial<TransferState>,
): Promise<TransferState> {
  const current = await getState(userId)
  if (!current) throw new Error('No active session to update')
  const next = { ...current, ...patch }
  await setState(userId, next)
  return next
}
