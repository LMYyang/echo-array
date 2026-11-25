import { describe, it, expect } from 'vitest'
import {
  createGame, startGame, flipCard, resolvePair, coverMismatch, coverJoker,
  replaceCard, peekCard, swapJoker, skipTurn, endTurn, refillHands, refillArray,
  isGameOver, viewOf, ARRAY_SIZE, HAND_SIZE,
} from '../src/core/game.js'
import { mulberry32, buildDeck, isJoker } from '../src/core/cards.js'
import { card } from './helpers.js'

function makeGame(seed = 42, playerCount = 4, settings = {}) {
  const g = createGame(mulberry32(seed), settings)
  startGame(g, playerCount)
  return g
}

function setSlot(g, i, c, faceUp = false) {
  g.array[i] = { card: c, faceUp }
}

function conservation(g) {
  const array = g.array.filter(Boolean).length
  const hands = g.players.reduce((s, p) => s + p.hand.length, 0)
  const collected = g.players.reduce((s, p) => s + p.collected.length, 0)
  return array + hands + collected + g.drawPile.length + g.discard.length
}

describe('开局发牌', () => {
  it('进入 PLAYING，12 张入阵，每人 4 张手牌，牌张守恒 54', () => {
    const g = makeGame(42, 4)
    expect(g.state).toBe('PLAYING')
    expect(g.array.filter(Boolean)).toHaveLength(ARRAY_SIZE)
    expect(g.players.every((p) => p.hand.length === HAND_SIZE)).toBe(true)
    expect(conservation(g)).toBe(54)
  })

  it('2 人局同样守恒', () => {
    const g = makeGame(7, 2)
    expect(g.players).toHaveLength(2)
    expect(conservation(g)).toBe(54)
  })
})

describe('翻牌配对', () => {
  it('同点数配对成功：收走两张并入收集堆', () => {
    const g = makeGame(42, 4)
    setSlot(g, 0, card('spade-A'))
    setSlot(g, 1, card('heart-A'))
    expect(flipCard(g, 0, 0).ok).toBe(true)
    expect(flipCard(g, 0, 1).ok).toBe(true)
    const res = resolvePair(g)
    expect(res.ok).toBe(true)
    expect(res.matched).toBe(true)
    expect(g.array[0]).toBeNull()
    expect(g.array[1]).toBeNull()
    expect(g.players[0].collected).toHaveLength(2)
    expect(conservation(g)).toBe(54)
  })

  it('点数不同：失败后盖回原位', () => {
    const g = makeGame(42, 4)
    setSlot(g, 0, card('spade-A'))
    setSlot(g, 1, card('heart-2'))
    flipCard(g, 0, 0)
    flipCard(g, 0, 1)
    const res = resolvePair(g)
    expect(res.matched).toBe(false)
    expect(g.array[0].faceUp).toBe(true)
    expect(coverMismatch(g).ok).toBe(true)
    expect(g.array[0].faceUp).toBe(false)
    expect(g.array[1].faceUp).toBe(false)
  })

  it('翻到小王：stage=joker，coverJoker 盖回', () => {
    const g = makeGame(42, 4)
    setSlot(g, 3, card('joker-SJ'))
    const res = flipCard(g, 0, 3)
    expect(res.ok).toBe(true)
    expect(res.joker).toBe(true)
    expect(g.pending.stage).toBe('joker')
    expect(coverJoker(g).ok).toBe(true)
    expect(g.array[3].faceUp).toBe(false)
  })

  it('第二张翻到王牌：按配对失败，两张一并盖回且守恒', () => {
    const g = makeGame(42, 4)
    setSlot(g, 0, card('spade-A'))
    setSlot(g, 1, card('joker-SJ'))
    expect(flipCard(g, 0, 0).ok).toBe(true)
    expect(flipCard(g, 0, 1).ok).toBe(true)
    expect(g.pending.stage).toBe('revealed')
    const res = resolvePair(g)
    expect(res.matched).toBe(false)
    expect(coverMismatch(g).ok).toBe(true)
    expect(g.array[0].faceUp).toBe(false)
    expect(g.array[1].faceUp).toBe(false)
    expect(conservation(g)).toBe(54)
  })
  it('非法翻牌不改状态：非当前座位 / 空槽 / 已翻开', () => {
    const g = makeGame(42, 4)
    expect(flipCard(g, 1, 0).ok).toBe(false)
    g.array[0] = null
    expect(flipCard(g, 0, 0).ok).toBe(false)
    g.array[0] = { card: card('spade-A'), faceUp: true }
    expect(flipCard(g, 0, 0).ok).toBe(false)
  })
})

describe('普通替换干扰', () => {
  it('成功替换：手牌正面入阵，原牌背面进空位，干扰次数 +1', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    g.drawPile.push(g.array[1].card) // 回收被腾空槽位的原牌，维持守恒
    g.array[1] = null
    g.array[0].faceUp = true // 原牌翻正面作为替换目标
    const res = replaceCard(g, 0, handCard.id, 0, 1)
    expect(res.ok).toBe(true)
    expect(g.array[0].card.id).toBe(handCard.id)
    expect(g.array[0].faceUp).toBe(true)
    expect(g.array[1].faceUp).toBe(false)
    expect(g.players[0].interferenceUsed).toBe(1)
    expect(conservation(g)).toBe(54)
  })

  it('干扰次数耗尽后拒绝', () => {
    const g = makeGame(42, 4, { interferenceLimit: 1 })
    g.players[0].interferenceUsed = 1
    const handCard = g.players[0].hand[0]
    setSlot(g, 0, card('spade-K'), true)
    g.array[1] = null
    expect(replaceCard(g, 0, handCard.id, 0, 1).ok).toBe(false)
  })

  it('目标必须正面朝上、落点必须是空位；王牌不可走普通替换', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    setSlot(g, 0, card('spade-K'), false) // 背面
    g.array[1] = null
    expect(replaceCard(g, 0, handCard.id, 0, 1).ok).toBe(false)

    setSlot(g, 0, card('spade-K'), true)
    expect(replaceCard(g, 0, handCard.id, 0, 0).ok).toBe(false) // 落点与目标同槽

    g.players[0].hand[0] = card('joker-SJ')
    expect(replaceCard(g, 0, 'joker-SJ', 0, 1).ok).toBe(false)
  })
})

describe('王牌行动', () => {
  it('小王窥视：仅本人记忆入账，小王进弃牌堆', () => {
    const g = makeGame(42, 4)
    g.players[0].hand[0] = card('joker-SJ')
    const target = g.array[2].card
    const res = peekCard(g, 0, 'joker-SJ', 2)
    expect(res.ok).toBe(true)
    expect(res.peeked.id).toBe(target.id)
    expect(g.discard).toHaveLength(1)
    expect(g.players[0].hand.some((c) => c.joker === 'SJ')).toBe(false)
    expect(g.players[0].memory.has(2)).toBe(true)
    expect(g.players[1].memory.has(2)).toBe(false)
    expect(conservation(g)).toBe(54)
  })

  it('大王强换：原牌进空位；无空位时进弃牌堆', () => {
    const g = makeGame(42, 4)
    g.players[0].hand[0] = card('joker-BJ')
    const displaced = g.array[4].card
    g.array[5] = null
    const res = swapJoker(g, 0, 'joker-BJ', 4, 5)
    expect(res.ok).toBe(true)
    expect(g.array[4].card.joker).toBe('BJ')
    expect(g.array[5].card.id).toBe(displaced.id)
    expect(g.array[5].faceUp).toBe(false)

    // 无空位：清空其余槽位后强换，原牌进弃牌堆
    const g2 = makeGame(43, 2)
    g2.players[0].hand[0] = card('joker-BJ')
    const disp2 = g2.array[2].card
    g2.array.forEach((s, i) => { if (i !== 2) g2.array[i] = null })
    const before = g2.discard.length
    const res2 = swapJoker(g2, 0, 'joker-BJ', 2, null)
    expect(res2.ok).toBe(true)
    expect(g2.discard.length).toBe(before + 1)
    expect(g2.discard[g2.discard.length - 1].id).toBe(disp2.id)
  })

  it('非王牌走对应行动被拒', () => {
    const g = makeGame(42, 4)
    expect(peekCard(g, 0, g.players[0].hand[0].id, 2).ok).toBe(false)
    expect(swapJoker(g, 0, g.players[0].hand[0].id, 2).ok).toBe(false)
  })
})

describe('补给与结束', () => {
  it('refillHands 补至 4 张，refillArray 每批最多 4 张背面牌', () => {
    const g = makeGame(42, 2)
    g.players[0].hand = []
    g.drawPile = [...buildDeck()].slice(0, 6)
    refillHands(g)
    expect(g.players[0].hand.length).toBe(4)

    g.array.forEach((s, i) => { if (i < 4) g.array[i] = null })
    g.drawPile = [...buildDeck()].slice(0, 6)
    refillArray(g, 4)
    const filled = g.array.filter(Boolean).length
    expect(filled).toBe(ARRAY_SIZE) // 原 8 张 + 补 4 张
  })

  it('阵空且抽牌堆耗尽 → 结束进入 SETTLE 并产出结算', () => {
    const g = makeGame(42, 3)
    g.array.forEach((_, i) => { g.array[i] = null })
    g.drawPile = []
    expect(isGameOver(g)).toBe(true)
    endTurn(g)
    expect(g.state).toBe('SETTLE')
    expect(g.result).toBeTruthy()
    expect(g.result.ranks).toHaveLength(3)
  })

  it('skipTurn 记录历史并轮转', () => {
    const g = makeGame(42, 3)
    expect(skipTurn(g, 0).ok).toBe(true)
    endTurn(g)
    expect(g.currentSeat).toBe(1)
  })
})

describe('脱敏视图 viewOf', () => {
  it('只暴露他人手牌张数，背面牌不带牌面', () => {
    const g = makeGame(42, 4)
    const v = viewOf(g, 0)
    expect(v.myHand).toHaveLength(4)
    expect(v.opponents.every((o) => o.handCount === 4)).toBe(true)
    expect(v.array.every((s) => s.faceUp || s.card === null)).toBe(true)
    expect(v.opponents[0]).not.toHaveProperty('hand')
  })
})
