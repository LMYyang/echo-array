import { describe, it, expect } from 'vitest'
import { isPair, countPairs, settle, scoreFor } from '../src/core/rules.js'
import { card } from './helpers.js'

describe('isPair 配对判定', () => {
  it('同点数不同花色可配对', () => {
    expect(isPair(card('spade-A'), card('heart-A'))).toBe(true)
  })
  it('不同点数不可配对', () => {
    expect(isPair(card('spade-A'), card('heart-2'))).toBe(false)
  })
  it('王牌不可配对', () => {
    expect(isPair(card('joker-SJ'), card('joker-BJ'))).toBe(false)
    expect(isPair(card('joker-SJ'), card('spade-A'))).toBe(false)
  })
})

describe('countPairs 成对计数', () => {
  it('按点数两两计数，王牌不计', () => {
    const collected = [
      card('spade-A'), card('heart-A'),
      card('spade-K'), card('heart-K'), card('club-K'),
      card('joker-SJ'),
    ]
    expect(countPairs(collected)).toBe(2)
  })
  it('空堆为 0', () => {
    expect(countPairs([])).toBe(0)
  })
})

describe('settle 结算', () => {
  function players(...collecteds) {
    return collecteds.map((collected, seat) => ({ seat, collected }))
  }

  it('收集张数最多者胜', () => {
    const p = players([card('spade-A'), card('heart-A')], [card('spade-K')], [])
    const r = settle(p, 3)
    expect(r.winner).toBe(0)
    expect(r.ranks[0].seat).toBe(0)
  })

  it('张数相同按配对对数破平', () => {
    const a = [card('spade-A'), card('heart-A'), card('spade-2')] // 1 对 + 1 单
    const b = [card('spade-K'), card('heart-K'), card('club-Q')] // 1 对 + 1 单 → 平
    const r = settle(players(a, b), 2)
    expect(r.winners).toHaveLength(2)
  })

  it('积分表：4 人局名次积分', () => {
    expect(scoreFor(0, 4)).toBe(6)
    expect(scoreFor(1, 4)).toBe(2)
    expect(scoreFor(2, 4)).toBe(0)
    expect(scoreFor(3, 4)).toBe(-2)
  })

  it('积分表：2 人局', () => {
    expect(scoreFor(0, 2)).toBe(6)
    expect(scoreFor(1, 2)).toBe(-2)
  })
})
