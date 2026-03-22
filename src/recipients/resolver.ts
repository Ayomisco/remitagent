import { findRecipient } from './registry.js'

const TRON_ADDRESS_RE = /^T[A-Za-z0-9]{33}$/
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export type AddressType = 'tron' | 'evm' | 'saved' | 'unknown'

export interface ResolvedRecipient {
  address: string
  type: AddressType
  chain: 'tron' | 'arbitrum'
}

/**
 * Resolve a free-text recipient (name, address, phone) to a wallet address.
 * Returns null if it can't be resolved — caller should ask the user.
 */
export async function resolveRecipient(
  input: string,
  ownerTelegramId: string,
): Promise<ResolvedRecipient | null> {
  const trimmed = input.trim()

  // Raw TRON address
  if (TRON_ADDRESS_RE.test(trimmed)) {
    return { address: trimmed, type: 'tron', chain: 'tron' }
  }

  // Raw EVM address
  if (EVM_ADDRESS_RE.test(trimmed)) {
    return { address: trimmed, type: 'evm', chain: 'arbitrum' }
  }

  // Saved contact
  const saved = await findRecipient(ownerTelegramId, trimmed)
  if (saved?.walletAddress) {
    return {
      address: saved.walletAddress,
      type: 'saved',
      chain: saved.preferredChain,
    }
  }

  return null
}
