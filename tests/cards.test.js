import { describe, it, expect } from 'vitest'
import { buildDeck, shuffle, mulberry32, isJoker, RANKS, SUITS } from '../src/core/cards.js'

describe('buildDeck 牌组构成', () => {
  it('一副 54 张：52 花色牌 + 2 王牌', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(54)
    const jokers = deck.filter(isJoker)
    expect(jokers).toHaveLength(2)
    expect(jokers.map((j) => j.joker).sort()).toEqual(['BJ', 'SJ'])
  })

  it('花色牌：4 花色 × 13 点数，id 唯一', () => {
    const deck = buildDeck()
    const suited = deck.filter((c) => !isJoker(c))
    expect(suited).toHaveLength(52)
    const ids = deck.map((c) => c.id)
    expect(new Set(ids).size).toBe(54)
    for (const suit of Object.keys(SUITS)) {
      for (const rank of RANKS) {
        expect(deck.some((c) => c.id === `${suit}-${rank}`)).toBe(true)
      }
    }
  })

  it('颜色判定：红心/方块红，黑桃/梅花黑', () => {
    const deck = buildDeck()
    const red = deck.filter((c) => !isJoker(c) && c.color === 'red').map((c) => c.suit)
    expect([...new Set(red)].sort()).toEqual(['diamond', 'heart'])
  })
})

describe('shuffle 洗牌', () => {
  it('种子相同则洗牌结果可复现', () => {
    const a = shuffle(buildDeck(), mulberry32(7))
    const b = shuffle(buildDeck(), mulberry32(7))
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })

  it('洗牌不丢牌、不重牌', () => {
    const s = shuffle(buildDeck(), mulberry32(3))
    expect(s).toHaveLength(54)
    expect(new Set(s.map((c) => c.id)).size).toBe(54)
  })
})
