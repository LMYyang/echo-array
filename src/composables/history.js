/** 战绩与历史持久化（key 前缀 echoarray_ 隔离）。存储失败静默降级。
 *  条目统一带 mode 字段（'solo'/'net'）；单机累计统计只记 solo，联网战绩从历史条目实时汇总。 */

const STATS_KEY = 'echoarray_stats'
const HISTORY_KEY = 'echoarray_history'
const MAX = 50

/** 读取单机累计战绩 { rounds, wins, totalCollected } */
export function loadStats() {
  try {
    return uni.getStorageSync(STATS_KEY) || { rounds: 0, wins: 0, totalCollected: 0 }
  } catch {
    return { rounds: 0, wins: 0, totalCollected: 0 }
  }
}

export function saveStats(stats) {
  try { uni.setStorageSync(STATS_KEY, stats) } catch { /* 存储不可用 */ }
}

/** 读取全部历史（最新在前） */
export function loadHistory() {
  try { return uni.getStorageSync(HISTORY_KEY) || [] } catch { return [] }
}

/**
 * 追加一局，最多保留 50 条。
 * entry 必备：mode / ranks / myCollected / winners；可带 playerCount, difficulty, names, roomId。
 */
export function appendHistory(entry) {
  const prev = loadHistory()
  try {
    uni.setStorageSync(HISTORY_KEY, [{ time: Date.now(), ...entry }, ...prev].slice(0, MAX))
  } catch { /* 存储不可用 */ }
}

/** 联网战绩从历史条目汇总（不回写 stats） */
export function netSummary(history = loadHistory()) {
  const net = history.filter((h) => h.mode === 'net')
  return {
    rounds: net.length,
    wins: net.filter((h) => (h.winners || []).includes(h.mySeat ?? 0)).length,
    totalCollected: net.reduce((s, h) => s + (h.myCollected || 0), 0),
  }
}

/** 近 N 局我方收集张数走势（最新在数组末尾），供主页图表使用 */
export function recentCollected(history = loadHistory(), n = 10) {
  return [...history].slice(0, n).reverse().map((h) => h.myCollected || 0)
}
