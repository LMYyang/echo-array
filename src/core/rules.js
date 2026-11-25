/**
 * 规则纯函数：配对判定、成对计数、结算排序与积分。
 * 不持有状态，便于单测覆盖边界。
 */

import { isJoker } from './cards.js'

/** 配对：两张普通花色牌且点数相同；王牌不可配对 */
export function isPair(a, b) {
  return !!a && !!b && !isJoker(a) && !isJoker(b) && a.rank === b.rank
}

/** 收集堆中成对数量：按点数两两计数，王牌不计 */
export function countPairs(collected) {
  const counts = {}
  for (const c of collected) {
    if (isJoker(c)) continue
    counts[c.rank] = (counts[c.rank] || 0) + 1
  }
  return Object.values(counts).reduce((s, n) => s + Math.floor(n / 2), 0)
}

/** 名次积分表（rankIndex 从 0 开始） */
export function scoreFor(rankIndex, playerCount) {
  if (playerCount === 2) return [6, -2][rankIndex] ?? 0
  if (playerCount === 3) return [6, 2, -2][rankIndex] ?? 0
  return [6, 2, 0, -2][rankIndex] ?? 0
}

/**
 * 结算。
 * @param players 各座位 { seat, collected }
 * @param playerCount 人数
 * @returns { winner, winners, ranks, scores }
 *   ranks 按名次升序：{ seat, collectedCount, pairs, rank, score }
 *   winners：收集数与对数都并列第一的座位集合
 */
export function settle(players, playerCount) {
  const info = players.map((p) => ({
    seat: p.seat,
    collectedCount: p.collected.length,
    pairs: countPairs(p.collected),
  }))

  const ordered = [...info].sort(
    (a, b) => b.collectedCount - a.collectedCount || b.pairs - a.pairs || a.seat - b.seat
  )

  const ranks = ordered.map((it, i) => ({
    ...it,
    rank: i + 1,
    score: scoreFor(i, playerCount),
  }))

  const top = ordered[0]
  const winners = ordered
    .filter((o) => o.collectedCount === top.collectedCount && o.pairs === top.pairs)
    .map((o) => o.seat)

  const scores = {}
  for (const r of ranks) scores[r.seat] = r.score

  return { winner: top.seat, winners, ranks, scores }
}
