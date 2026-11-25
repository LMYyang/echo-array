/**
 * 牌组构造与随机工具（纯 JS、平台无关）。
 * 54 张：52 花色牌（4 花色 × 13 点数）+ 小王 + 大王。
 */

export const SUITS = {
  spade: { label: '♠', color: 'black' },
  heart: { label: '♥', color: 'red' },
  club: { label: '♣', color: 'black' },
  diamond: { label: '♦', color: 'red' },
}

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/** mulberry32 种子随机数生成器，返回 () => [0,1)；测试用固定种子复现 */
export function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates 洗牌，返回新数组 */
export function shuffle(cards, rng = Math.random) {
  const arr = [...cards]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 构造一副 54 张牌 */
export function buildDeck() {
  const deck = []
  for (const suit of Object.keys(SUITS)) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        rank,
        suit,
        color: SUITS[suit].color,
        joker: null,
        label: rank,
        suitLabel: SUITS[suit].label,
      })
    }
  }
  deck.push({
    id: 'joker-SJ', rank: 'SJ', suit: null, color: 'black',
    joker: 'SJ', label: '小王', suitLabel: '',
  })
  deck.push({
    id: 'joker-BJ', rank: 'BJ', suit: null, color: 'red',
    joker: 'BJ', label: '大王', suitLabel: '',
  })
  return deck
}

/** 是否王牌 */
export function isJoker(card) {
  return !!card && !!card.joker
}

/** 按 id 取牌（测试辅助） */
export function findCard(deck, id) {
  return deck.find((c) => c.id === id) || null
}
