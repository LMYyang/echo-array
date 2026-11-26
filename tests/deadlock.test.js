/**
 * 回归：全 AI 自动对局必须能自然结束。
 * 旧实现里阵中会残留收不走的牌（王牌 / 孤牌），结束条件永远不成立 → 无限空转。
 */
import { describe, it, expect } from 'vitest'
import {
  createGame, startGame, flipCard, resolvePair, coverMismatch, coverJoker,
  cancelPending, shiftCard, peekCard, swapJoker, skipTurn, endTurn,
} from '../src/core/game.js'
import { aiChooseAction } from '../src/core/ai.js'
import { mulberry32 } from '../src/core/cards.js'

function applyChoice(g, seat, choice) {
  switch (choice.action) {
    case 'flip': {
      const [a, b] = choice.slots
      const r1 = flipCard(g, seat, a)
      if (r1.ok && r1.joker) { coverJoker(g); return }
      const claimed = r1.ok && r1.claimSlot != null
      if (!claimed) {
        const ok2 = Number.isInteger(b) && g.array[b] && !g.array[b].faceUp
          ? flipCard(g, seat, b).ok
          : false
        if (!ok2) { if (g.pending.stage === 'picked') cancelPending(g); return }
      }
      const r = resolvePair(g)
      if (r.ok && !r.matched) coverMismatch(g)
      return
    }
    case 'replace':
      shiftCard(g, seat, choice.handCardId, choice.targetSlot, choice.mode)
      return
    case 'peek':
      peekCard(g, seat, choice.handCardId, choice.slot)
      return
    case 'swap':
      swapJoker(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot ?? null)
      return
    default:
      skipTurn(g, seat)
  }
}

function playGame(seed, playerCount = 4, maxTurns = 4000) {
  const g = createGame(mulberry32(seed), { playerCount })
  startGame(g, playerCount)
  let turns = 0
  const trace = []
  while (g.state === 'PLAYING' && turns < maxTurns) {
    const seat = g.currentSeat
    const choice = aiChooseAction(g, seat)
    applyChoice(g, seat, choice)
    trace.push(`${seat}:${choice.action}${choice.slots ? JSON.stringify(choice.slots) : ''}`)
    if (g.state === 'PLAYING') endTurn(g)
    turns += 1
  }
  return { g, turns, trace }
}

function conservation(g) {
  const array = g.array.filter(Boolean).length
  const hands = g.players.reduce((s, p) => s + p.hand.length, 0)
  const collected = g.players.reduce((s, p) => s + p.collected.length, 0)
  return array + hands + collected + g.drawPile.length + g.discard.length
}

describe('自动对局收敛性', () => {
  it('60 局 4 人全 AI 对局全部进入结算，且牌张守恒', () => {
    const maxTurns = []
    for (let seed = 1; seed <= 60; seed++) {
      const { g, turns, trace } = playGame(seed, 4)
      // 诊断信息只在失败时报出来，平时不刷屏
      const diag = `seed=${seed} turns=${turns} state=${g.state} array=${
        JSON.stringify(g.array.map((s, i) => (s ? `${i}:${s.card.rank}${s.faceUp ? '↑' : '↓'}` : null)).filter(Boolean))
      } draw=${g.drawPile.length} hands=${g.players.map((p) => p.hand.length)} ifu=${
        g.players.map((p) => p.interferenceUsed)} limit=${g.settings.interferenceLimit} collected=${
        g.players.map((p) => p.collected.length)} | trace=${trace.slice(-16).join(' | ')}`
      expect(g.state, diag).toBe('SETTLE')
      expect(g.result).toBeTruthy()
      expect(conservation(g)).toBe(54)
      expect(turns).toBeLessThan(4000)
      maxTurns.push(turns)
    }
    const avg = maxTurns.reduce((a, b) => a + b, 0) / maxTurns.length
    // 只作观察：平均回合数不应无限增长
    expect(avg).toBeLessThan(600)
  })
})
