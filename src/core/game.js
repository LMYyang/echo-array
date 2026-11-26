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

  // 亮牌认领：阵中若已有同点数的正面牌，翻出同点数背面牌即刻配对
  // 把亮牌当作"已经翻开的第一张"，本张作第二张，后续直接走 resolvePair 收牌
  if (g.pending.stage === 'idle') {
    const claimSlot = g.array.findIndex(
      (c, i) => c && c.faceUp && i !== slot && !isJoker(c.card) && c.card.rank === s.card.rank,
    )
    if (claimSlot >= 0) {
      g.pending = { first: claimSlot, second: slot, stage: 'revealed', claim: true }
      g.history.push({
        seat, action: 'flip', slots: [claimSlot, slot], ok: true, claim: true, turnNo: g.turnNo,
      })
      return { ok: true, claimSlot }
    }
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

/** 撤销本回合已翻开的牌（AI 只翻到一张、又凑不到第二张时兜底，避免留下脏 pending） */
export function cancelPending(g) {
  if (g.pending.stage === 'idle') return { ok: false, reason: '无可撤销的翻牌' }
  for (const i of [g.pending.first, g.pending.second]) {
    if (i != null && g.array[i]) g.array[i].faceUp = false
  }
  g.pending = { first: null, second: null, stage: 'idle' }
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

/**
 * 行动 B：回声移位（手牌干扰）。
 * 打出一张普通手牌 H 进入阵中任意非空槽 T；T 的原牌 A 退回抽牌堆底（牌堆空则进弃牌堆）。
 * mode：'loud' 明投（H 正面朝上，全场可见）/ 'mute' 暗投（H 背面朝下，仅投放者知道内容）。
 * 不再要求空位落点——干扰从"替换"变为"改写记忆地图"。
 */
export function shiftCard(g, seat, handCardId, targetSlot, mode = 'loud') {
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
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= ARRAY_SIZE) {
    return { ok: false, reason: '槽位非法' }
  }
  if (mode !== 'loud' && mode !== 'mute') return { ok: false, reason: '投放方式非法' }

  const target = g.array[targetSlot]
  if (!target) return { ok: false, reason: '该槽位为空，无法改写' }

  const displaced = target.card
  player.hand.splice(handIdx, 1)
  target.card = card
  target.faceUp = mode === 'loud'
  // 被换出的牌回抽牌堆底，之后补牌时以未知位置重入阵面；牌堆耗尽则进弃牌堆
  if (g.drawPile.length > 0) g.drawPile.push(displaced)
  else g.discard.push(displaced)
  player.interferenceUsed += 1

  forgetSlot(g, targetSlot)
  // 明投是公开亮牌，所有 AI 记一条；暗投只有投放者自己知道
  if (mode === 'loud') observePublic(g, targetSlot, card)
  else observePrivate(g, seat, targetSlot, card)

  g.history.push({
    seat, action: 'replace', slots: [targetSlot], handCardId, mode, ok: true, turnNo: g.turnNo,
  })
  return { ok: true, mode, displaced }
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

/**
 * 阵中是否还存在「可收走」的成对牌：同点数 ≥2 张，且至少有一张是背面。
 * 王牌不可配对；两张都正面朝上的同点数牌也配不起来（正面牌翻不动，只能被认领）。
 */
export function hasPairInArray(g) {
  const counts = new Map() // rank -> { all, down }
  for (const s of g.array) {
    if (!s || isJoker(s.card)) continue
    const rec = counts.get(s.card.rank) || { all: 0, down: 0 }
    rec.all += 1
    if (!s.faceUp) rec.down += 1
    counts.set(s.card.rank, rec)
  }
  for (const rec of counts.values()) {
    if (rec.all >= 2 && rec.down >= 1) return true
  }
  return false
}

/**
 * 是否还有人能用回声移位改写阵面（手牌普通牌 + 还剩干扰次数 + 阵中有槽）。
 * 阵面无对可成时，只有改写还能造出新的配对，所以这是「还能不能继续」的最后一道判据。
 */
export function canStillShift(g) {
  const occupied = g.array.filter(Boolean)
  if (occupied.length < 2) return false
  // 只有「手牌点数在阵中已经有一张」时，替换才可能凑出新的成对
  const ranksInArray = new Set(occupied.filter((s) => !isJoker(s.card)).map((s) => s.card.rank))
  if (!ranksInArray.size) return false
  return g.players.some(
    (p) => p.interferenceUsed < g.settings.interferenceLimit
      && p.hand.some((c) => !isJoker(c) && ranksInArray.has(c.rank)),
  )
}

/**
 * 结束判定：
 * 1. 阵面全空且抽牌堆耗尽；
 * 2. 或阵中已无可成对的普通牌，且补牌进不来（阵满/牌堆空），又没人再能改写阵面。
 * 只判「阵中全空」会让对局永久空转：王牌、孤牌收不走，阵面卡在无对状态时谁也动不了。
 */
export function isGameOver(g) {
  const arrayEmpty = g.array.every((s) => s === null)
  if (arrayEmpty) return g.drawPile.length === 0
  if (hasPairInArray(g)) return false
  // 还有空位 + 还有牌：下一回合补牌会带进新牌，仍可能凑出新对
  if (g.drawPile.length > 0 && g.array.some((s) => s === null)) return false
  return !canStillShift(g)
}

/** 回合结束：结清未完成的翻牌 → 补给 → 结束判定 → 轮转下一座位 */
export function endTurn(g) {
  // 回合内只翻了一张（阵中不足两张背面牌 / 主动跳过）时，把翻开的牌盖回，
  // 避免留下一张永远收不走的正面牌
  if (g.pending.stage !== 'idle') {
    for (const i of [g.pending.first, g.pending.second]) {
      if (i != null && g.array[i]) g.array[i].faceUp = false
    }
    g.pending = { first: null, second: null, stage: 'idle' }
  }
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
