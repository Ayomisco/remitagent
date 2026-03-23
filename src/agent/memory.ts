import { redis } from '../db/redis.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_HISTORY = 20       // messages kept per user
const TTL_SECONDS = 60 * 60  // 1 hour idle expiry

function key(userId: string) {
  return `chat:history:${userId}`
}

export async function getHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const raw = await redis.get(key(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function appendHistory(
  userId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  try {
    const history = await getHistory(userId)
    history.push({ role: 'user', content: userMessage })
    history.push({ role: 'assistant', content: assistantReply })
    // Keep only the last MAX_HISTORY messages
    const trimmed = history.slice(-MAX_HISTORY)
    await redis.setex(key(userId), TTL_SECONDS, JSON.stringify(trimmed))
  } catch {
    // non-fatal — history is a nice-to-have
  }
}

export async function clearHistory(userId: string): Promise<void> {
  await redis.del(key(userId))
}
