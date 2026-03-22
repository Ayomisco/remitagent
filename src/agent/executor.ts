import { sendUSDt } from '../wallet/transfer.js'
import type { Chain } from '../wallet/userWallet.js'
import type { TransferPlan } from './planner.js'
import type { ParsedIntent } from './parser.js'

export interface ExecuteParams {
  senderId: string
  recipientAddress: string
  recipientTelegramId?: string
  plan: TransferPlan
  intent: ParsedIntent
  chain?: Chain
}

export async function executeTransfer(params: ExecuteParams) {
  const { senderId, recipientAddress, recipientTelegramId, plan, intent, chain = 'tron' } = params

  return sendUSDt({
    senderId,
    recipientAddress,
    recipientTelegramId,
    amountUsdt: plan.usdtAmount,
    chain,
    notes: intent.rawText,
    rateSource: plan.bestQuote.source,
    feePct: plan.feeUsdt / plan.usdtAmount,
  })
}
