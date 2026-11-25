import { describe, it, expect } from 'vitest'
import { createGame, startGame } from '../src/core/game.js'
import { mulberry32 } from '../src/core/cards.js'
import { card } from './helpers.js'
import {
  DIFFICULTY, observePublic, observePrivate, forgetSlot, aiChooseAction, aiThinkDelay,
} from '../src/core/ai.js'

function g(seed = 1, playerCount = 4, difficulty = 'normal') {
  const game = createGame(mulberry32(seed), { difficulty })
  startGame(game, playerCount)
  return game
}

describe('难度参数表', () => {
  it('三档参数齐全', () => {
    for (const key of ['easy', 'normal', 'hard']) {
      const p = DIFFICULTY[key]
      expect(p.memoryAccuracy).toBeGreaterThan(0)
      expect(p.recallAccuracy).toBeGreaterThan(0)
      expect(p.interferenceRate).toBeGreaterThanOrEqual(0)
      expect(p.thinkDelay).toHaveLength(2)
    }
  })

  it('困难档记忆与召回高于简单档', () => {
    expect(DIFFICULTY.hard.memoryAccuracy).toBeGreaterThan(DIFFICULTY.easy.memoryAccuracy)
    expect(DIFFICULTY.hard.recallAccuracy).toBeGreaterThan(DIFFICULTY.easy.recallAccuracy)
  })
})

describe('AI 记忆模型', () => {
  it('公开入账写入 AI 记忆，forgetSlot 清除', () => {
    // 确定性 rng（恒返回 0），保证高准确率档位必然入账
    const hard = createGame(() => 0, { difficulty: 'hard' })
    startGame(hard, 4)
    observePublic(hard, 3, hard.array[3].card)
    expect(hard.players[1].memory.has(3)).toBe(true)
    forgetSlot(hard, 3)
    expect(hard.players[1].memory.has(3)).toBe(false)
  })

  it('窥视入账仅写入指定座位', () => {
    const game = g(3)
    observePrivate(game, 2, 5, game.array[5].card)
    expect(game.players[2].memory.has(5)).toBe(true)
    expect(game.players[1].memory.has(5)).toBe(false)
  })
})

describe('aiChooseAction 决策输出', () => {
  it('返回合法行动类型', () => {
    const game = g(4)
    const choice = aiChooseAction(game, 1)
    expect(['flip', 'replace', 'peek', 'swap', 'skip']).toContain(choice.action)
  })

  it('翻牌行动给出两个不同槽位', () => {
    const game = g(5, 2, 'hard')
    const choice = aiChooseAction(game, 1)
    if (choice.action === 'flip') {
      expect(choice.slots).toHaveLength(2)
      expect(choice.slots[0]).not.toBe(choice.slots[1])
    }
  })

  it('思考延时落在难度区间内', () => {
    const game = g(6, 4, 'easy')
    const d = aiThinkDelay(game)
    expect(d).toBeGreaterThanOrEqual(DIFFICULTY.easy.thinkDelay[0])
    expect(d).toBeLessThanOrEqual(DIFFICULTY.easy.thinkDelay[1])
  })

  it('记忆命中亮牌点数时优先认领', () => {
    const game = createGame(() => 0, { difficulty: 'hard' })
    startGame(game, 4)
    game.array[0] = { card: card('spade-K'), faceUp: true }
    game.array[1] = { card: card('heart-K'), faceUp: false }
    game.players[1].memory.set(1, { rank: 'K', confidence: 1, knownAt: 0 })
    const choice = aiChooseAction(game, 1)
    expect(choice.action).toBe('flip')
    expect(choice.slots[0]).toBe(1)
  })

  it('回声移位决策带合法投放方式与非空目标', () => {
    for (const key of ['easy', 'normal', 'hard']) {
      expect(DIFFICULTY[key].baitRate).toBeGreaterThanOrEqual(0)
      expect(DIFFICULTY[key].blindRate).toBeGreaterThanOrEqual(0)
      expect(DIFFICULTY[key].blindRate).toBeLessThanOrEqual(1)
    }
    for (let seed = 1; seed <= 30; seed++) {
      const game = g(seed, 4, 'hard')
      for (const seat of [1, 2, 3]) {
        const choice = aiChooseAction(game, seat)
        if (choice.action !== 'replace') continue
        expect(['loud', 'mute']).toContain(choice.mode)
        expect(game.array[choice.targetSlot]).toBeTruthy()
        return
      }
    }
  })
})
