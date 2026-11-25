/**
 * 对局状态机（纯 JS、平台无关、可变状态对象）。
 * state: 'DEAL' | 'PLAYING' | 'SETTLE'
 * 行动函数都返回 { ok: boolean, reason?: string }，非法动作不改状态。
 *
 * 回声阵：12 槽（3 行 4 列，索引 0–11）；每人手牌 4 张；抽牌堆补给。
 */

import { buildDeck, shuffle, isJoker } from './cards.js'
import { isPair, settle } from './rules.js'
import { normalizeSettings, DEFAULT_SETTINGS } from './settings.js'
import { observePublic, observePrivate, forgetSlot } from './ai.js'

export const ARRAY_SIZE = 12
export const HAND_SIZE = 4
export const REFILL_BATCH = 4

const faceUpSlots = (g) => g.array.map((s, i) => (s && s.faceUp ? i : null)).filter((i) => i !== null)
const faceDownSlots = (g) => g.array.map((s, i) => (s && !s.faceUp ? i : null)).filter((i) => i !== null)
const emptySlots = (g) => g.array.map((s, i) => (s ? null : i)).filter((i) => i !== null)

/** 构造空状态（DEAL）；rng 可注入种子随机数便于测试复现 */
export function createGame(rng = Math.random, settings = DEFAULT_SETTINGS) {
  return {
    rng,
    state: 'DEAL',
    playerCount: 4,
    settings: normalizeSettings(settings),
    array: new Array(ARRAY_SIZE).fill(null),
    drawPile: [],
    discard: [],
    players: [],
    currentSeat: 0,
    turnNo: 1,
    pending: { first: null, second: null, stage: 'idle' }, // idle | picked | revealed | joker
    history: [],
    result: null,
  }
}

/** 开局：洗牌、12 张入阵、每人 4 张手牌、剩余入抽牌堆，进入 PLAYING */
export function startGame(g, playerCount) {
  const n = [2, 3, 4].includes(playerCount) ? playerCount : g.settings.playerCount
  g.playerCount = n
  const deck = shuffle(buildDeck(), g.rng)

  for (let i = 0; i < ARRAY_SIZE; i++) {
    g.array[i] = { card: deck[i], faceUp: false }
  }
  let idx = ARRAY_SIZE
  g.players = []
  for (let seat = 0; seat < n; seat++) {
    const hand = deck.slice(idx, idx + HAND_SIZE)
    idx += HAND_SIZE
    g.players.push({ seat, hand, collected: [], interferenceUsed: 0, memory: new Map() })
  }
  g.drawPile = deck.slice(idx)
  g.discard = []
  g.currentSeat = 0
  g.turnNo = 1
  g.pending = { first: null, second: null, stage: 'idle' }
  g.history = []
  g.result = null
  g.state = 'PLAYING'
  return { ok: true }
}

/** 翻牌：第一张 stage=picked，第二张 stage=revealed；翻到王牌 stage=joker（单张待盖回） */
export function flipCard(g, seat, slot) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (seat !== g.currentSeat) return { ok: false, reason: '没轮到该座位' }
  if (g.pending.stage === 'revealed' || g.pending.stage === 'joker') {
    return { ok: false, reason: '翻牌比对中' }
  }
  if (!Number.isInteger(slot) || slot < 0 || slot >= ARRAY_SIZE) {
    return { ok: false, reason: '槽位非法' }
  }
  const s = g.array[slot]
  if (!s) return { ok: false, reason: '该槽位为空' }
  if (s.faceUp) return { ok: false, reason: '该牌已翻开' }

  s.faceUp = true
  observePublic(g, slot, s.card)

  // 第一张即王牌：单张展示后盖回；第二张翻到王牌按配对失败处理（走 revealed 比对后盖回）
  if (isJoker(s.card) && g.pending.stage === 'idle') {
    g.pending = { first: slot, second: null, stage: 'joker' }
    g.history.push({ seat, action: 'flip', slots: [slot], ok: true, joker: true, turnNo: g.turnNo })
    return { ok: true, joker: true }
  }

  if (g.pending.stage === 'idle') {
    g.pending.first = slot
    g.pending.stage = 'picked'
  } else {
    g.pending.second = slot
    g.pending.stage = 'revealed'
  }
  return { ok: true }
}

/** 比对本回合两张牌：成功收走，失败保留正面待盖回 */
export function resolvePair(g) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (g.pending.stage !== 'revealed') return { ok: false, reason: '无可比对的两张牌' }

  const first = g.pending.first
  const second = g.pending.second
  const a = g.array[first]
  const b = g.array[second]
  if (!a || !b) return { ok: false, reason: '牌位已不存在' }

  const seat = g.currentSeat
  const player = g.players[seat]
  let matched = false
  let reason = '点数不同'

  if (isJoker(a.card) || isJoker(b.card)) {
    reason = '王牌不可配对'
  } else if (isPair(a.card, b.card)) {
    matched = true
    player.collected.push(a.card, b.card)
    g.array[first] = null
    g.array[second] = null
    forgetSlot(g, first)
    forgetSlot(g, second)
  }

  g.history.push({
    seat, action: 'flip', slots: [first, second], ok: true, matched, reason, turnNo: g.turnNo,
  })

  if (matched) {
    g.pending = { first: null, second: null, stage: 'idle' }
  }
  // 失败：stage 保持 revealed，等待 coverMismatch 盖回
  return { ok: true, matched, reason }
}

/** 把配对失败的两张盖回原位 */
export function coverMismatch(g) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (g.pending.stage !== 'revealed') return { ok: false, reason: '没有待盖回的牌' }
  for (const i of [g.pending.first, g.pending.second]) {
    if (g.array[i]) g.array[i].faceUp = false
  }
  g.pending = { first: null, second: null, stage: 'idle' }
  return { ok: true }
}

/** 翻到王牌后的盖回（单张） */
export function coverJoker(g) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (g.pending.stage !== 'joker') return { ok: false, reason: '没有待盖回的王牌' }
  const i = g.pending.first
  if (g.array[i]) g.array[i].faceUp = false
  g.pending = { first: null, second: null, stage: 'idle' }
  return { ok: true }
}

/** 行动 B：普通替换干扰。handCardId=手牌普通牌；targetSlot=正面目标；emptySlot=落点空位 */
export function replaceCard(g, seat, handCardId, targetSlot, emptySlot) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (seat !== g.currentSeat) return { ok: false, reason: '没轮到该座位' }
  const player = g.players[seat]
  if (player.interferenceUsed >= g.settings.interferenceLimit) {
    return { ok: false, reason: '本局干扰次数已用完' }
  }
  const handIdx = player.hand.findIndex((c) => c.id === handCardId)
  if (handIdx < 0) return { ok: false, reason: '手牌中不存在该牌' }
  const card = player.hand[handIdx]
  if (isJoker(card)) return { ok: false, reason: '王牌请使用专属行动' }

  const target = g.array[targetSlot]
  if (!target || !target.faceUp) return { ok: false, reason: '替换目标必须是已翻开的牌' }
  if (emptySlot === targetSlot) return { ok: false, reason: '落点不能与目标同槽' }
  if (g.array[emptySlot]) return { ok: false, reason: '落点必须是空位' }

  const displaced = target.card
  player.hand.splice(handIdx, 1)
  target.card = card
  target.faceUp = true
  g.array[emptySlot] = { card: displaced, faceUp: false }
  player.interferenceUsed += 1

  forgetSlot(g, targetSlot)
  forgetSlot(g, emptySlot)
  g.history.push({
    seat, action: 'replace', slots: [targetSlot, emptySlot], handCardId, ok: true, turnNo: g.turnNo,
  })
  return { ok: true }
}

/** 行动 C-1：小王窥视。查看背面槽位，仅本人记忆入账，小王进弃牌堆 */
export function peekCard(g, seat, handCardId, slot) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (seat !== g.currentSeat) return { ok: false, reason: '没轮到该座位' }
  const player = g.players[seat]
  const handIdx = player.hand.findIndex((c) => c.id === handCardId)
  if (handIdx < 0) return { ok: false, reason: '手牌中不存在该牌' }
  const joker = player.hand[handIdx]
  if (joker.joker !== 'SJ') return { ok: false, reason: '该牌不是小王' }

  const target = g.array[slot]
  if (!target || target.faceUp) return { ok: false, reason: '只能窥视背面朝上的牌' }

  const peeked = target.card
  player.hand.splice(handIdx, 1)
  g.discard.push(joker)
  observePrivate(g, seat, slot, peeked)

  g.history.push({ seat, action: 'peek', slots: [slot], handCardId, ok: true, turnNo: g.turnNo })
  return { ok: true, peeked }
}

/** 行动 C-2：大王强换。不查看原牌；原牌进空位（无空位则进弃牌堆） */
export function swapJoker(g, seat, handCardId, targetSlot, emptySlot = null) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (seat !== g.currentSeat) return { ok: false, reason: '没轮到该座位' }
  const player = g.players[seat]
  const handIdx = player.hand.findIndex((c) => c.id === handCardId)
  if (handIdx < 0) return { ok: false, reason: '手牌中不存在该牌' }
  const joker = player.hand[handIdx]
  if (joker.joker !== 'BJ') return { ok: false, reason: '该牌不是大王' }

  const target = g.array[targetSlot]
  if (!target) return { ok: false, reason: '目标槽位为空' }

  const displaced = target.card
  player.hand.splice(handIdx, 1)
  target.card = joker
  target.faceUp = true

  if (emptySlot != null && !g.array[emptySlot]) {
    g.array[emptySlot] = { card: displaced, faceUp: false }
  } else {
    g.discard.push(displaced)
  }

  forgetSlot(g, targetSlot)
  if (emptySlot != null) forgetSlot(g, emptySlot)
  g.history.push({
    seat, action: 'swap', slots: [targetSlot, emptySlot].filter((x) => x != null),
    handCardId, ok: true, turnNo: g.turnNo,
  })
  return { ok: true }
}

/** 无合法行动时跳过回合 */
export function skipTurn(g, seat) {
  if (g.state !== 'PLAYING') return { ok: false, reason: '非对局阶段' }
  if (seat !== g.currentSeat) return { ok: false, reason: '没轮到该座位' }
  g.history.push({ seat, action: 'skip', ok: true, turnNo: g.turnNo })
  return { ok: true }
}

/** 回合末补手牌至 4 张 */
export function refillHands(g) {
  for (const p of g.players) {
    while (p.hand.length < HAND_SIZE && g.drawPile.length > 0) {
      p.hand.push(g.drawPile.shift())
    }
  }
}

/** 回合末补阵面：每批最多 REFILL_BATCH 张背面牌 */
export function refillArray(g, batch = REFILL_BATCH) {
  let added = 0
  for (let i = 0; i < ARRAY_SIZE && added < batch; i++) {
    if (!g.array[i] && g.drawPile.length > 0) {
      g.array[i] = { card: g.drawPile.shift(), faceUp: false }
      added += 1
    }
  }
}

/** 结束判定：阵中全空且抽牌堆耗尽 */
export function isGameOver(g) {
  return g.array.every((s) => s === null) && g.drawPile.length === 0
}

/** 回合结束：补给 → 结束判定 → 轮转下一座位 */
export function endTurn(g) {
  refillHands(g)
  refillArray(g, REFILL_BATCH)

  if (isGameOver(g)) {
    g.result = settle(g.players, g.playerCount)
    g.state = 'SETTLE'
    return
  }
  g.currentSeat = (g.currentSeat + 1) % g.playerCount
  g.turnNo += 1
  g.pending = { first: null, second: null, stage: 'idle' }
}

/** 当前玩家是否还有可翻的背面牌 */
export function hasFaceDown(g) {
  return faceDownSlots(g).length > 0
}

/** 为 UI 准备的脱敏视图（不泄露他人手牌与 AI 记忆；背面牌不带 card） */
export function viewOf(g, viewerSeat) {
  const me = g.players[viewerSeat]
  return {
    state: g.state,
    playerCount: g.playerCount,
    currentSeat: g.currentSeat,
    turnNo: g.turnNo,
    array: g.array.map((s, i) => (s
      ? { slot: i, faceUp: s.faceUp, card: s.faceUp ? s.card : null }
      : null)),
    drawCount: g.drawPile.length,
    myHand: me ? [...me.hand] : [],
    myCollected: me ? [...me.collected] : [],
    myInterferenceUsed: me ? me.interferenceUsed : 0,
    opponents: g.players
      .filter((p) => p.seat !== viewerSeat)
      .map((p) => ({
        seat: p.seat,
        handCount: p.hand.length,
        collectedCount: p.collected.length,
        interferenceUsed: p.interferenceUsed,
      })),
    pending: { ...g.pending },
    history: g.history,
    result: g.result,
    settings: { ...g.settings },
  }
}
