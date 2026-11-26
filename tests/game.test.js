import { describe, it, expect } from 'vitest'
import {
  createGame, startGame, flipCard, resolvePair, coverMismatch, coverJoker,
  shiftCard, peekCard, swapJoker, skipTurn, endTurn, refillHands, refillArray,
  isGameOver, viewOf, ARRAY_SIZE, HAND_SIZE, cancelPending, hasPairInArray,
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

describe('回声移位干扰（明投 / 暗投）', () => {
  it('明投：手牌正面入阵，原牌回抽牌堆底，干扰次数 +1', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    const original = g.array[0].card
    g.array[0].faceUp = true
    const pileLen = g.drawPile.length
    const res = shiftCard(g, 0, handCard.id, 0, 'loud')
    expect(res.ok).toBe(true)
    expect(res.mode).toBe('loud')
    expect(res.displaced.id).toBe(original.id)
    expect(g.array[0].card.id).toBe(handCard.id)
    expect(g.array[0].faceUp).toBe(true)
    expect(g.drawPile.length).toBe(pileLen + 1)
    expect(g.drawPile[g.drawPile.length - 1].id).toBe(original.id)
    expect(g.players[0].interferenceUsed).toBe(1)
    expect(conservation(g)).toBe(54)
  })

  it('暗投：牌面朝下，他人看不到，槽位记忆被清空', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    g.array[3].faceUp = true
    const res = shiftCard(g, 0, handCard.id, 3, 'mute')
    expect(res.ok).toBe(true)
    expect(res.mode).toBe('mute')
    expect(g.array[3].faceUp).toBe(false)
    expect(g.array[3].card.id).toBe(handCard.id)
    expect(conservation(g)).toBe(54)
  })

  it('目标可以是背面牌，任意非空槽都可改写', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    setSlot(g, 5, card('heart-Q'), false)
    const res = shiftCard(g, 0, handCard.id, 5)
    expect(res.ok).toBe(true)
    expect(g.array[5].card.id).toBe(handCard.id)
    expect(conservation(g)).toBe(54)
  })

  it('空槽、非法槽位、非法投放方式均拒绝', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    g.array[1] = null
    expect(shiftCard(g, 0, handCard.id, 1).ok).toBe(false)
    expect(shiftCard(g, 0, handCard.id, 0, 'silent').ok).toBe(false)
    expect(shiftCard(g, 0, handCard.id, 0, 'shout').ok).toBe(false)
  })

  it('干扰次数耗尽后拒绝', () => {
    const g = makeGame(42, 4, { interferenceLimit: 1 })
    g.players[0].interferenceUsed = 1
    const handCard = g.players[0].hand[0]
    setSlot(g, 0, card('spade-K'), true)
    expect(shiftCard(g, 0, handCard.id, 0).ok).toBe(false)
  })

  it('王牌不可走回声移位', () => {
    const g = makeGame(42, 4)
    g.players[0].hand[0] = card('joker-SJ')
    expect(shiftCard(g, 0, 'joker-SJ', 0).ok).toBe(false)
  })

  it('抽牌堆耗尽时被换出的牌进弃牌堆', () => {
    const g = makeGame(42, 4)
    const handCard = g.players[0].hand.find((c) => !isJoker(c))
    const original = g.array[0].card
    // 把抽牌堆整体腾空（牌转入弃牌堆，维持守恒）
    g.discard.push(...g.drawPile)
    g.drawPile.length = 0
    const res = shiftCard(g, 0, handCard.id, 0)
    expect(res.ok).toBe(true)
    expect(g.discard[g.discard.length - 1].id).toBe(original.id)
    expect(conservation(g)).toBe(54)
  })
})

describe('亮牌认领', () => {
  it('翻出与亮牌同点数的背面牌，直接配对收走两张', () => {
    const g = makeGame(42, 4)
    g.array[0] = { card: card('spade-K'), faceUp: true }
    g.array[5] = { card: card('heart-K'), faceUp: false }
    const res = flipCard(g, 0, 5)
    expect(res.ok).toBe(true)
    expect(res.claimSlot).toBe(0)
    expect(g.pending.stage).toBe('revealed')
    expect(g.pending.claim).toBe(true)
    const r = resolvePair(g)
    expect(r.matched).toBe(true)
    expect(g.array[0]).toBeNull()
    expect(g.array[5]).toBeNull()
    expect(g.players[0].collected).toHaveLength(2)
    expect(conservation(g)).toBe(54)
  })

  it('点数不同不触发认领，仍按普通翻牌继续', () => {
    const g = makeGame(42, 4)
    g.array[0] = { card: card('spade-K'), faceUp: true }
    g.array[5] = { card: card('heart-Q'), faceUp: false }
    const res = flipCard(g, 0, 5)
    expect(res.ok).toBe(true)
    expect(res.claimSlot).toBeUndefined()
    expect(g.pending.stage).toBe('picked')
  })

  it('翻到王牌不触发认领', () => {
    const g = makeGame(42, 4)
    g.array[0] = { card: card('spade-K'), faceUp: true }
    g.array[5] = { card: card('joker-SJ'), faceUp: false }
    const res = flipCard(g, 0, 5)
    expect(res.joker).toBe(true)
    expect(res.claimSlot).toBeUndefined()
  })

  it('多张同点数亮牌时取槽位序号最小的一张', () => {
    const g = makeGame(42, 4)
    g.array[2] = { card: card('spade-K'), faceUp: true }
    g.array[7] = { card: card('club-K'), faceUp: true }
    g.array[9] = { card: card('heart-K'), faceUp: false }
    const res = flipCard(g, 0, 9)
    expect(res.claimSlot).toBe(2)
    expect(g.pending.first).toBe(2)
    expect(g.pending.second).toBe(9)
  })

  it('cancelPending 把已翻开的牌盖回并清空 pending', () => {
    const g = makeGame(42, 4)
    flipCard(g, 0, 5)
    expect(cancelPending(g).ok).toBe(true)
    expect(g.array[5].faceUp).toBe(false)
    expect(g.pending.stage).toBe('idle')
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

  it('抽牌堆耗尽 + 阵中全是王牌 → 结束（王牌永远收不走）', () => {
    const g = makeGame(42, 2)
    g.array.forEach((_, i) => { g.array[i] = null })
    g.array[0] = { card: card('joker-SJ'), faceUp: false }
    g.array[5] = { card: card('joker-BJ'), faceUp: true }
    g.drawPile = []
    expect(hasPairInArray(g)).toBe(false)
    expect(isGameOver(g)).toBe(true)
    endTurn(g)
    expect(g.state).toBe('SETTLE')
  })

  it('抽牌堆耗尽 + 阵中残牌互不同点数 → 结束（无对可成）', () => {
    const g = makeGame(42, 2)
    g.array.forEach((_, i) => { g.array[i] = null })
    g.array[2] = { card: card('spade-A'), faceUp: false }
    g.array[7] = { card: card('heart-K'), faceUp: false }
    g.drawPile = []
    expect(isGameOver(g)).toBe(true)
  })

  it('抽牌堆耗尽但阵中还有同点数两张 → 继续（不能提前结束）', () => {
    const g = makeGame(42, 2)
    g.array.forEach((_, i) => { g.array[i] = null })
    g.array[2] = { card: card('spade-A'), faceUp: false }
    g.array[9] = { card: card('club-A'), faceUp: false }
    g.drawPile = []
    expect(hasPairInArray(g)).toBe(true)
    expect(isGameOver(g)).toBe(false)
    endTurn(g)
    expect(g.state).toBe('PLAYING')
  })

  it('抽牌堆还有牌时即使阵中无对也不算结束（补牌还能继续）', () => {
    const g = makeGame(42, 2)
    g.array.forEach((_, i) => { g.array[i] = null })
    g.array[0] = { card: card('joker-SJ'), faceUp: false }
    g.drawPile = [card('spade-A')]
    expect(isGameOver(g)).toBe(false)
  })

  it('回合结束时把未配对的单张翻牌盖回，不留永久亮牌', () => {
    const g = makeGame(42, 3)
    expect(flipCard(g, 0, 4).ok).toBe(true)
    expect(g.pending.stage).toBe('picked')
    expect(g.array[4].faceUp).toBe(true)
    endTurn(g)
    expect(g.array[4].faceUp).toBe(false)
    expect(g.pending.stage).toBe('idle')
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
