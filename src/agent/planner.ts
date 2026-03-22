import { getBestRate, fiatToUsdt } from '../rates/aggregator.js'
import type { RateQuote } from '../rates/aggregator.js'
import type { ParsedIntent } from './parser.js'

export interface TransferPlan {
  usdtAmount: number
  bestQuote: RateQuote
  allQuotes: RateQuote[]
  feeUsdt: number
  recipientGets?: string
}

/**
 * Given a parsed intent, work out:
 * - how many USDt to send
 * - best rate source
 * - fee breakdown
 */
export async function buildTransferPlan(intent: ParsedIntent): Promise<TransferPlan> {
  const { amount = 0, fromCurrency = 'USD', toCurrency } = intent

  const usdtAmount = await fiatToUsdt(amount, fromCurrency)
  const feeUsdt = usdtAmount * 0.005 // 0.5% RemitAgent fee

  // If recipient currency is known, show how much they receive
  let recipientGets: string | undefined
  let allQuotes: RateQuote[] = []

  if (toCurrency && toCurrency !== 'USDT') {
    allQuotes = await getBestRate('USDT', toCurrency, usdtAmount)
    const bestQuote = allQuotes[0]
    const localAmount = (usdtAmount - feeUsdt) * bestQuote.rate
    recipientGets = `${localAmount.toFixed(2)} ${toCurrency} (via ${bestQuote.source})`
  } else {
    // No target currency known — just show USDT
    allQuotes = [{ source: 'RemitAgent', rate: 1, fee: 0.5, estimatedDelivery: '< 1 minute' }]
  }

  return {
    usdtAmount: parseFloat(usdtAmount.toFixed(6)),
    bestQuote: allQuotes[0],
    allQuotes,
    feeUsdt: parseFloat(feeUsdt.toFixed(6)),
    recipientGets,
  }
}
