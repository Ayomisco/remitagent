import { getUserWallet, type Chain } from './userWallet.js'
import { db } from '../db/postgres.js'

// USDt contract addresses per chain
const USDT_CONTRACTS: Record<Chain, string> = {
  tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',      // USDT TRC-20 mainnet
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT ERC-20 on Arbitrum
}

export interface TransferParams {
  senderId: string
  recipientAddress: string
  recipientTelegramId?: string
  amountUsdt: number
  chain?: Chain
  notes?: string
  rateSource?: string
  feePct?: number
}

export interface TransferResult {
  success: boolean
  txHash: string
  transferId: number
  explorerUrl: string
}

export async function sendUSDt(params: TransferParams): Promise<TransferResult> {
  const {
    senderId,
    recipientAddress,
    recipientTelegramId,
    amountUsdt,
    chain = 'tron',
    notes,
    rateSource,
    feePct,
  } = params

  const { account: senderAccount, address: senderAddress } = await getUserWallet(senderId, chain)

  // USDt has 6 decimal places — convert to smallest unit
  const amountRaw = BigInt(Math.floor(amountUsdt * 1_000_000))

  // Check USDT token balance (not native balance)
  const tokenAddress = USDT_CONTRACTS[chain]
  const rawBalance = await senderAccount.getTokenBalance(tokenAddress)
  if (rawBalance < amountRaw) {
    const have = Number(rawBalance) / 1_000_000
    throw new Error(
      `Insufficient USDt balance. You have ${have.toFixed(2)} USDt, need ${amountUsdt.toFixed(2)} USDt.\n\nAdd funds: /deposit`,
    )
  }

  // Record pending transfer in DB before executing
  const { rows } = await db.query(
    `INSERT INTO transfers
       (sender_telegram_id, recipient_telegram_id, sender_address, recipient_address,
        amount_usdt, chain, status, notes, rate_source, fee_pct)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9) RETURNING id`,
    [
      senderId,
      recipientTelegramId ?? null,
      senderAddress,
      recipientAddress,
      amountUsdt,
      chain,
      notes ?? '',
      rateSource ?? null,
      feePct ?? null,
    ],
  )
  const transferId: number = rows[0].id

  try {
    // Use account.transfer() for token (USDt) — NOT sendTransaction() which is for native currency
    const result = await senderAccount.transfer({
      token: tokenAddress,
      recipient: recipientAddress,
      amount: amountRaw,
    })

    await db.query(
      `UPDATE transfers SET status='completed', tx_hash=$1, completed_at=NOW() WHERE id=$2`,
      [result.hash, transferId],
    )

    const explorerUrl =
      chain === 'tron'
        ? `https://tronscan.org/#/transaction/${result.hash}`
        : `https://arbiscan.io/tx/${result.hash}`

    return { success: true, txHash: result.hash, transferId, explorerUrl }
  } catch (err) {
    await db.query(`UPDATE transfers SET status='failed', error=$1 WHERE id=$2`, [
      (err as Error).message,
      transferId,
    ])
    throw err
  }
}
