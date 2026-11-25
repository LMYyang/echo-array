/**
 * 设置规整（单机本地存储与未来房间设置共用形态）。
 * playerCount: 2 | 3 | 4；difficulty: easy | normal | hard；
 * interferenceLimit: 1–5；muted: boolean。
 */

export const DEFAULT_SETTINGS = {
  playerCount: 4,
  difficulty: 'normal',
  interferenceLimit: 3,
  muted: false,
}

const PLAYER_COUNTS = [2, 3, 4]
const DIFFICULTIES = ['easy', 'normal', 'hard']

/** 规整任意输入为合法 settings：缺省补齐、类型校验、越界回退、多余字段剥离 */
export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}

  const playerCount = PLAYER_COUNTS.includes(Number(src.playerCount))
    ? Number(src.playerCount)
    : DEFAULT_SETTINGS.playerCount

  const difficulty = DIFFICULTIES.includes(src.difficulty)
    ? src.difficulty
    : DEFAULT_SETTINGS.difficulty

  let interferenceLimit = Number(src.interferenceLimit)
  if (!Number.isInteger(interferenceLimit)) {
    interferenceLimit = DEFAULT_SETTINGS.interferenceLimit
  }
  interferenceLimit = Math.min(5, Math.max(1, interferenceLimit))

  const muted = typeof src.muted === 'boolean' ? src.muted : DEFAULT_SETTINGS.muted

  return { playerCount, difficulty, interferenceLimit, muted }
}
