/**
 * AI：记忆模型 + 难度参数 + 决策输出。
 * 只读取 core 状态与自身 memory，不依赖视图层；不导入 game.js，避免循环依赖。
 */

import { isJoker } from './cards.js'

/** 难度参数表：记忆准确率 / 召回准确率 / 干扰频率 / 窥视倾向 / 思考延时区间 */
export const DIFFICULTY = {
  easy: {
    memoryAccuracy: 0.55, recallAccuracy: 0.50,
    interferenceRate: 0.15, peekRate: 0.30, thinkDelay: [1600, 2400],
  },
  normal: {
    memoryAccuracy: 0.80, recallAccuracy: 0.75,
    interferenceRate: 0.30, peekRate: 0.50, thinkDelay: [1200, 1900],
  },
  hard: {
    memoryAccuracy: 0.95, recallAccuracy: 0.92,
    interferenceRate: 0.45, peekRate: 0.70, thinkDelay: [900, 1500],
  },
}

const faceUpSlots = (g) => g.array.map((s, i) => (s && s.faceUp ? i : null)).filter((i) => i !== null)
const faceDownSlots = (g) => g.array.map((s, i) => (s && !s.faceUp ? i : null)).filter((i) => i !== null)
const emptySlots = (g) => g.array.map((s, i) => (s ? null : i)).filter((i) => i !== null)
const occupiedSlots = (g) => g.array.map((s, i) => (s ? i : null)).filter((i) => i !== null)

function randomOf(arr, rng) {
  return arr[Math.floor(rng() * arr.length)]
}

function paramsOf(g) {
  return DIFFICULTY[g.settings.difficulty] || DIFFICULTY.normal
}

/** 公开亮牌入账：所有 AI 按记忆准确率记录（真人 seat 0 无记忆） */
export function observePublic(g, slot, card) {
  const params = paramsOf(g)
  for (const p of g.players) {
    if (p.seat === 0) continue
    if (g.rng() < params.memoryAccuracy) {
      p.memory.set(slot, { rank: card.rank, confidence: params.recallAccuracy, knownAt: g.turnNo })
    }
  }
}

/** 窥视入账：仅写入窥视者本人记忆，满置信 */
export function observePrivate(g, seat, slot, card) {
  const p = g.players[seat]
  if (p) p.memory.set(slot, { rank: card.rank, confidence: 1, knownAt: g.turnNo })
}

/** 槽位被替换 / 盖回时，清除所有 AI 该槽旧记忆 */
export function forgetSlot(g, slot) {
  for (const p of g.players) p.memory.delete(slot)
}

/** 记忆中两张同点数背面槽位（按召回准确率抽检） */
function rememberedPair(g, seat, params) {
  const p = g.players[seat]
  const byRank = new Map()
  for (const [slot, mem] of p.memory) {
    if (!g.array[slot] || g.array[slot].faceUp) continue
    if (g.rng() < params.recallAccuracy) {
      if (!byRank.has(mem.rank)) byRank.set(mem.rank, [])
      byRank.get(mem.rank).push(Number(slot))
    }
  }
  for (const slots of byRank.values()) {
    if (slots.length >= 2) return [slots[0], slots[1]]
  }
  return null
}

/** 翻牌选槽：优先记忆槽位，其次随机未知槽 */
function chooseFlip(g, seat, params, down) {
  if (down.length === 0) return null
  const p = g.players[seat]
  const recalled = []
  const unknown = []
  for (const slot of down) {
    const mem = p.memory.get(slot)
    if (mem && g.rng() < params.recallAccuracy) recalled.push(slot)
    else unknown.push(slot)
  }
  const first = recalled[0] ?? unknown[0] ?? down[0]
  let secondPool = recalled.filter((s) => s !== first)
  if (!secondPool.length) secondPool = unknown.filter((s) => s !== first)
  if (!secondPool.length) secondPool = down.filter((s) => s !== first)
  if (!secondPool.length) return null
  return { action: 'flip', slots: [first, secondPool[0]] }
}

/**
 * AI 决策。返回：
 * { action:'flip', slots:[a,b] } | { action:'replace', handCardId, targetSlot, emptySlot }
 * | { action:'peek', handCardId, slot } | { action:'swap', handCardId, targetSlot, emptySlot? }
 * | { action:'skip' }
 */
export function aiChooseAction(g, seat) {
  const p = g.players[seat]
  const params = paramsOf(g)
  const rng = g.rng

  const down = faceDownSlots(g)
  const up = faceUpSlots(g)
  const empty = emptySlots(g)

  // 1. 已知配对优先
  const pair = rememberedPair(g, seat, params)
  if (pair) return { action: 'flip', slots: pair }

  const normalHand = p.hand.filter((c) => !isJoker(c))
  const sj = p.hand.find((c) => c.joker === 'SJ')
  const bj = p.hand.find((c) => c.joker === 'BJ')
  const canReplace = p.interferenceUsed < g.settings.interferenceLimit &&
    up.length > 0 && empty.length > 0 && normalHand.length > 0

  // 2. 干扰分支
  if (rng() < params.interferenceRate) {
    if (canReplace) {
      return {
        action: 'replace',
        handCardId: randomOf(normalHand, rng).id,
        targetSlot: randomOf(up, rng),
        emptySlot: randomOf(empty, rng),
      }
    }
    if (bj) {
      const occupied = occupiedSlots(g)
      if (occupied.length) {
        return {
          action: 'swap',
          handCardId: bj.id,
          targetSlot: randomOf(occupied, rng),
          emptySlot: empty.length ? randomOf(empty, rng) : null,
        }
      }
    }
    if (sj && down.length && rng() < params.peekRate) {
      return { action: 'peek', handCardId: sj.id, slot: randomOf(down, rng) }
    }
  }

  // 3. 翻牌
  const flip = chooseFlip(g, seat, params, down)
  if (flip) return flip

  // 4. 兜底：窥视 → 替换 → 跳过
  if (sj && down.length) return { action: 'peek', handCardId: sj.id, slot: randomOf(down, rng) }
  if (canReplace) {
    return {
      action: 'replace',
      handCardId: randomOf(normalHand, rng).id,
      targetSlot: randomOf(up, rng),
      emptySlot: randomOf(empty, rng),
    }
  }
  return { action: 'skip' }
}

/** AI 思考延时（毫秒），按难度区间随机 */
export function aiThinkDelay(g) {
  const [a, b] = paramsOf(g).thinkDelay
  return a + Math.floor(g.rng() * (b - a))
}
