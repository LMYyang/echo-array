import { buildDeck, findCard, mulberry32 } from '../src/core/cards.js'
import { createGame, startGame } from '../src/core/game.js'

/** 按 id 取牌，如 card('spade-A') */
export function card(id) {
  const c = findCard(buildDeck(), id)
  if (!c) throw new Error(`unknown card id: ${id}`)
  return c
}

/** 构造一个已开局的对局（可注入种子） */
export function startedGame(seed = 42, playerCount = 4, settings = {}) {
  const g = createGame(mulberry32(seed), settings)
  startGame(g, playerCount)
  return g
}
