import type { Context } from 'telegraf'
import { parseIntent } from '../../agent/parser.js'
import { buildTransferPlan } from '../../agent/planner.js'
import { executeTransfer } from '../../agent/executor.js'
import { getState, setState, clearState, updateState } from '../../agent/fsm.js'
import { resolveRecipient } from '../../recipients/resolver.js'
import { saveRecipient } from '../../recipients/registry.js'
import { appendHistory } from '../../agent/memory.js'
import {
  transferSummaryMessage,
  recipientConfirmedMessage,
  processingMessage,
  transferCompleteMessage,
  cancelMessage,
  errorMessage,
  savedContactMessage,
} from '../../notifications/templates.js'

export async function handleSendFlow(ctx: Context, message: string): Promise<void> {
  const userId = String(ctx.from!.id)

  const intent = await parseIntent(message)
  if (intent.type !== 'send' || !intent.amount) {
    await ctx.reply(
      "Hmm, didn't quite catch that. Try something like: \"Send $200 to Maria in Mexico\"",
    )
    return
  }

  let plan
  try {
    await ctx.reply('Let me check the best rate for you...')
    plan = await buildTransferPlan(intent)
  } catch (err) {
    await ctx.reply(errorMessage((err as Error).message))
    return
  }

  const resolved = intent.recipient
    ? await resolveRecipient(intent.recipient, userId)
    : null

  const preferredChain = plan.usdtAmount > 500 ? 'arbitrum' : 'tron'
  const step = resolved ? 'confirm_transfer' : 'enter_recipient'

  await setState(userId, {
    step,
    parsed: intent,
    quote: { ...plan.bestQuote, usdtAmount: plan.usdtAmount },
    recipientAddress: resolved?.address,
    preferredChain,
  } as any)

  await ctx.reply(
    transferSummaryMessage({
      amount: intent.amount,
      fromCurrency: intent.fromCurrency ?? 'USD',
      usdtAmount: plan.usdtAmount,
      recipient: intent.recipient ?? 'recipient',
      recipientCountry: intent.recipientCountry,
      recipientGets: plan.recipientGets,
      bestSource: plan.bestQuote.source,
      delivery: plan.bestQuote.estimatedDelivery,
      needsAddress: !resolved,
      resolvedFrom: resolved ? 'saved contact' : undefined,
    }),
    { parse_mode: 'Markdown' },
  )
}

export async function handleActiveConversation(ctx: Context, message: string): Promise<void> {
  const userId = String(ctx.from!.id)
  const state = await getState(userId)

  if (!state) {
    await ctx.reply(sessionExpired())
    return
  }

  const lower = message.toLowerCase().trim()

  if (lower === 'cancel' || lower === 'abort' || lower === 'stop' || lower === 'no') {
    await clearState(userId)
    await ctx.reply(cancelMessage())
    return
  }

  // ── Enter recipient step ─────────────────────────────────────────────────
  if (state.step === 'enter_recipient') {
    const resolved = await resolveRecipient(message.trim(), userId)
    if (!resolved) {
      await ctx.reply(
        "That doesn't look like a valid wallet address. TRON addresses start with T, Arbitrum with 0x.\n\nWhat's the address? Or type CANCEL.",
      )
      return
    }
    await updateState(userId, { step: 'confirm_transfer', recipientAddress: resolved.address })
    await ctx.reply(
      recipientConfirmedMessage(resolved.address, state.quote.usdtAmount),
      { parse_mode: 'Markdown' },
    )
    return
  }

  // ── Confirm step ─────────────────────────────────────────────────────────
  if (state.step === 'confirm_transfer') {
    if (lower !== 'confirm' && lower !== 'yes' && lower !== 'go' && lower !== 'send') {
      await ctx.reply(
        `Just reply CONFIRM to send ${state.quote.usdtAmount.toFixed(2)} USDt, or CANCEL to abort.`,
      )
      return
    }

    if (!state.recipientAddress) {
      await clearState(userId)
      await ctx.reply("Something went wrong — missing recipient address. Please start over.")
      return
    }

    await ctx.reply(processingMessage())

    try {
      const result = await executeTransfer({
        senderId: userId,
        recipientAddress: state.recipientAddress,
        plan: {
          usdtAmount: state.quote.usdtAmount,
          bestQuote: state.quote,
          allQuotes: [state.quote],
          feeUsdt: state.quote.usdtAmount * 0.005,
        },
        intent: state.parsed,
        chain: 'tron',
      })

      await clearState(userId)

      await ctx.reply(
        transferCompleteMessage({
          usdtAmount: state.quote.usdtAmount,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        }),
        { parse_mode: 'Markdown' },
      )

      // Write to conversation memory so user can ask "how did that go?"
      const recipient = state.parsed.recipient ?? state.recipientAddress
      await appendHistory(
        userId,
        `[Transfer completed] ${state.quote.usdtAmount} USDt sent to ${recipient} (${state.recipientAddress})`,
        `Done. TX hash: ${result.txHash}. TronScan: ${result.explorerUrl}`,
      )

      // Silently save new named recipients for future use
      if (
        state.parsed.recipient &&
        !state.parsed.recipient.startsWith('T') &&
        !state.parsed.recipient.startsWith('0x')
      ) {
        await saveRecipient(userId, {
          name: state.parsed.recipient,
          walletAddress: state.recipientAddress,
          country: state.parsed.recipientCountry,
          preferredChain: 'tron',
        }).catch(() => {})

        await ctx.reply(savedContactMessage(state.parsed.recipient))
      }
    } catch (err) {
      await clearState(userId)
      await ctx.reply(errorMessage((err as Error).message))
    }
    return
  }
}

function sessionExpired(): string {
  return "That session timed out — no worries. Just start again: \"Send $X to someone\""
}
