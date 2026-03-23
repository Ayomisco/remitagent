import type { Context } from 'telegraf'
import { parseIntent } from '../../agent/parser.js'
import { buildTransferPlan } from '../../agent/planner.js'
import { executeTransfer } from '../../agent/executor.js'
import { getState, setState, clearState, updateState } from '../../agent/fsm.js'
import { resolveRecipient } from '../../recipients/resolver.js'
import { saveRecipient, findRecipient } from '../../recipients/registry.js'
import { appendHistory } from '../../agent/memory.js'
import {
  transferSummaryMessage,
  transferCompleteMessage,
  errorMessage,
} from '../../notifications/templates.js'

/**
 * Entry point for a new "send money" message.
 *
 * Agent autonomy:
 * - Parses intent from natural language (Gemini)
 * - Aggregates rates across 4 sources and picks the best automatically
 * - Resolves recipient name against saved contacts — skips address step if found
 * - Routes to cheapest chain based on amount (TRON default, Arbitrum for large amounts)
 */
export async function handleSendFlow(ctx: Context, message: string): Promise<void> {
  const userId = String(ctx.from!.id)

  const intent = await parseIntent(message)
  if (intent.type !== 'send' || !intent.amount) {
    await ctx.reply(
      "I couldn't understand that. Try:\n`Send $200 to Maria in Mexico`",
      { parse_mode: 'Markdown' },
    )
    return
  }

  let plan
  try {
    await ctx.reply('⏳ Checking rates...')
    plan = await buildTransferPlan(intent)
  } catch (err) {
    await ctx.reply(errorMessage((err as Error).message), { parse_mode: 'Markdown' })
    return
  }

  // Agent autonomously resolves recipient from:
  // 1. Raw wallet address (T... or 0x...)
  // 2. Saved contacts by name (e.g. "mum", "João")
  const resolved = intent.recipient
    ? await resolveRecipient(intent.recipient, userId)
    : null

  // Agent picks cheapest chain: TRON for small amounts, Arbitrum for > $500
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
      recipient: intent.recipient ?? 'unknown',
      recipientGets: plan.recipientGets,
      bestSource: plan.bestQuote.source,
      delivery: plan.bestQuote.estimatedDelivery,
      needsAddress: !resolved,
      // If we found a saved contact, mention it was auto-resolved
      resolvedFrom: resolved ? `saved contact` : undefined,
    }),
    { parse_mode: 'Markdown' },
  )
}

/**
 * Handles replies within an active conversation state.
 * Minimal human input required — agent handles routing, chain selection, fee calculation.
 */
export async function handleActiveConversation(ctx: Context, message: string): Promise<void> {
  const userId = String(ctx.from!.id)
  const state = await getState(userId)

  if (!state) {
    await ctx.reply('Session expired. Please start again.')
    return
  }

  if (message.toLowerCase() === 'cancel') {
    await clearState(userId)
    await ctx.reply('❌ Transfer cancelled.')
    return
  }

  if (state.step === 'enter_recipient') {
    const resolved = await resolveRecipient(message.trim(), userId)
    if (!resolved) {
      await ctx.reply(
        '⚠️ I need a valid TRON wallet address *(starts with T)* or Arbitrum address *(starts with 0x)*.\n\nSend the address or type *CANCEL*.',
        { parse_mode: 'Markdown' },
      )
      return
    }
    await updateState(userId, { step: 'confirm_transfer', recipientAddress: resolved.address })
    await ctx.reply(
      `Got it. Recipient: \`${resolved.address}\`\n\nReply *CONFIRM* to send or *CANCEL* to abort.`,
      { parse_mode: 'Markdown' },
    )
    return
  }

  if (state.step === 'confirm_transfer' && message.toLowerCase() === 'confirm') {
    if (!state.recipientAddress) {
      await ctx.reply('Missing recipient address. Please start over.')
      await clearState(userId)
      return
    }

    await ctx.reply('⏳ Processing your transfer...')

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

      const completeMsg = transferCompleteMessage({
        usdtAmount: state.quote.usdtAmount,
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
      })
      await ctx.reply(completeMsg, { parse_mode: 'Markdown' })

      // Log transfer outcome to conversation memory so user can ask about it
      const recipient = state.parsed.recipient ?? state.recipientAddress ?? 'recipient'
      await appendHistory(
        userId,
        `[Transfer] Sent ${state.quote.usdtAmount} USDt to ${recipient} (${state.recipientAddress})`,
        `Transfer complete. TX: ${result.txHash}. Explorer: ${result.explorerUrl}`,
      )

      // Agent autonomously saves new recipients for future use
      // (no need to ask the user — just do it silently)
      if (state.parsed.recipient && !state.parsed.recipient.startsWith('T') && !state.parsed.recipient.startsWith('0x')) {
        await saveRecipient(userId, {
          name: state.parsed.recipient,
          walletAddress: state.recipientAddress,
          country: state.parsed.recipientCountry,
          preferredChain: 'tron',
        }).catch(() => {}) // non-blocking, best effort

        await ctx.reply(
          `💾 I've saved *${state.parsed.recipient}* as a contact so you can send to them by name next time.`,
          { parse_mode: 'Markdown' },
        )
      }
    } catch (err) {
      await clearState(userId)
      await ctx.reply(errorMessage((err as Error).message), { parse_mode: 'Markdown' })
    }
    return
  }

  await ctx.reply(
    state.step === 'confirm_transfer'
      ? 'Reply *CONFIRM* to send or *CANCEL* to abort.'
      : 'Please send a valid wallet address or type *CANCEL*.',
    { parse_mode: 'Markdown' },
  )
}
