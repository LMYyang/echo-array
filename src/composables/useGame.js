// 单机局管理：真人固定 seat 0，其余座位由 AI 补足。
// core 状态机 + reactive 视图 + AI 延时调度 + 战绩持久化 + 音效/播报钩子。
import { reactive, computed } from 'vue'
import {
  createGame, startGame, flipCard, resolvePair, coverMismatch, coverJoker,
  replaceCard, peekCard, swapJoker, skipTurn, endTurn, viewOf,
} from '../core/game.js'
import { aiChooseAction, aiThinkDelay } from '../core/ai.js'
import { normalizeSettings } from '../core/settings.js'
import { loadStats, saveStats, appendHistory } from './history.js'
import { useSound } from './useSound.js'

const SEAT_LABELS = ['我', '下家', '对家', '上家']

export function useGame() {
  const sound = useSound()
  const settings = normalizeSettings(uni.getStorageSync('echoarray_settings'))
  const g = createGame(Math.random, settings)
  startGame(g, settings.playerCount)

  const fx = reactive({
    mode: 'flip', // flip | replace | peek | swap
    selectedHandId: null,
    targetSlot: null,
    emptySlot: null,
    settleShow: false,
    thinking: false,
    peekCard: null,
    lastReason: '',
    announcements: [], // 最近播报文字
  })

  const view = reactive(viewOf(g, 0))

  const myTurn = computed(() => view.state === 'PLAYING' && view.currentSeat === 0)
  const interferenceLeft = computed(() => view.settings.interferenceLimit - view.myInterferenceUsed)
  const labelOf = (seat) => SEAT_LABELS[seat] || `座位${seat}`

  function syncView() {
    const v = viewOf(g, 0)
    v.myHand = [...v.myHand]
    v.myCollected = [...v.myCollected]
    v.opponents = v.opponents.map((o) => ({ ...o }))
    v.array = v.array.map((s) => (s ? { ...s } : null))
    Object.assign(view, v)
  }

  function toast(reason) {
    fx.lastReason = reason || ''
    if (reason) uni.showToast({ title: reason, icon: 'none' })
  }

  function announce(text) {
    if (!text) return
    fx.announcements.push({ id: Date.now() + Math.random(), text })
    if (fx.announcements.length > 4) fx.announcements.shift()
    sound.announce(text)
  }

  // ---------- 真人行动 ----------

  /** 点选手牌：普通牌进替换模式；小王进窥视；大王进强换 */
  function selectHand(card) {
    if (!myTurn.value) return
    if (!card.joker && interferenceLeft.value <= 0) {
      toast('本局干扰次数已用完')
      return
    }
    if (card.joker === 'SJ') {
      fx.mode = 'peek'
    } else if (card.joker === 'BJ') {
      fx.mode = 'swap'
    } else {
      fx.mode = 'replace'
    }
    fx.selectedHandId = card.id
    fx.targetSlot = null
    fx.emptySlot = null
  }

  function cancelMode() {
    fx.mode = 'flip'
    fx.selectedHandId = null
    fx.targetSlot = null
    fx.emptySlot = null
  }

  function onArrayTap(slot) {
    if (!myTurn.value) return
    if (fx.mode === 'flip') return doFlip(slot)
    if (fx.mode === 'replace') return doReplaceSelect(slot)
    if (fx.mode === 'peek') return doPeek(slot)
    if (fx.mode === 'swap') return doSwap(slot)
  }

  function doFlip(slot) {
    const res = flipCard(g, 0, slot)
    if (!res.ok) { toast(res.reason); return }
    sound.play('flip')
    syncView()
    if (res.joker) {
      announce('翻到王牌，盖回原位')
      setTimeout(() => { coverJoker(g); afterAction() }, 1000)
      return
    }
    if (g.pending.stage === 'revealed') {
      setTimeout(() => {
        const r = resolvePair(g)
        syncView()
        if (r.ok && r.matched) {
          sound.play('match')
          announce('配对成功，收走两张')
        } else if (r.ok && !r.matched) {
          sound.play('miss')
          announce('点数不同，盖回')
        }
        if (r.ok && !r.matched) {
          setTimeout(() => { coverMismatch(g); afterAction() }, 900)
        } else {
          afterAction()
        }
      }, 900)
    }
  }

  function doReplaceSelect(slot) {
    const cell = view.array[slot]
    if (fx.targetSlot === null) {
      if (!cell || !cell.faceUp) { toast('请选择一张已翻开的牌作为目标'); return }
      fx.targetSlot = slot
      return
    }
    if (cell) { toast('请选择一个空位作为落点'); return }
    fx.emptySlot = slot
    const res = replaceCard(g, 0, fx.selectedHandId, fx.targetSlot, fx.emptySlot)
    if (!res.ok) { toast(res.reason); cancelMode(); return }
    sound.play('replace')
    announce('完成手牌干扰')
    syncView()
    afterAction()
  }

  function doPeek(slot) {
    const cell = view.array[slot]
    if (cell && cell.faceUp) { toast('只能窥视背面朝上的牌'); return }
    const res = peekCard(g, 0, fx.selectedHandId, slot)
    if (!res.ok) { toast(res.reason); cancelMode(); return }
    sound.play('peek')
    announce('暗中窥视了一张牌')
    fx.peekCard = res.peeked
    syncView()
    setTimeout(() => { fx.peekCard = null; afterAction() }, 1200)
  }

  function doSwap(slot) {
    const cell = view.array[slot]
    if (!cell) { toast('目标槽位不能为空'); return }
    const empty = view.array.findIndex((c) => c === null)
    const res = swapJoker(g, 0, fx.selectedHandId, slot, empty >= 0 ? empty : null)
    if (!res.ok) { toast(res.reason); cancelMode(); return }
    sound.play('swap')
    announce('大王强换完成')
    syncView()
    afterAction()
  }

  /** 真人主动跳过回合（无合法行动时兜底） */
  function skipTurnHuman() {
    if (!myTurn.value) return
    const res = skipTurn(g, 0)
    if (!res.ok) { toast(res.reason); return }
    announce('跳过回合')
    afterAction()
  }

  // ---------- 回合收尾 + AI 调度 ----------

  function afterAction() {
    cancelMode()
    endTurn(g)
    syncView()
    if (g.state === 'SETTLE') {
      persistSettle()
      fx.settleShow = true
      return
    }
    if (g.currentSeat === 0) sound.play('turn')
    scheduleAiIfNeeded()
  }

  function scheduleAiIfNeeded() {
    if (g.state !== 'PLAYING' || g.currentSeat === 0) return
    fx.thinking = true
    const seat = g.currentSeat
    setTimeout(() => {
      if (g.state !== 'PLAYING' || g.currentSeat !== seat) { fx.thinking = false; return }
      runAiAction(seat)
      fx.thinking = false
      afterAction()
    }, aiThinkDelay(g))
  }

  function runAiAction(seat) {
    const choice = aiChooseAction(g, seat)
    switch (choice.action) {
      case 'flip': {
        const [a, b] = choice.slots
        const r1 = flipCard(g, seat, a)
        if (r1.ok && r1.joker) { coverJoker(g); break }
        flipCard(g, seat, b)
        const r = resolvePair(g)
        if (r.ok && !r.matched) coverMismatch(g)
        break
      }
      case 'replace':
        replaceCard(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot)
        break
      case 'peek':
        peekCard(g, seat, choice.handCardId, choice.slot)
        break
      case 'swap':
        swapJoker(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot ?? null)
        break
      default:
        skipTurn(g, seat)
    }
  }

  function persistSettle() {
    const stats = loadStats()
    const myCollected = view.myCollected.length
    stats.rounds += 1
    if (g.result.winners.includes(0)) {
      stats.wins += 1
      sound.play('win')
      announce('本局获胜')
    } else {
      sound.play('lose')
    }
    stats.totalCollected += myCollected
    saveStats(stats)
    appendHistory({
      mode: 'solo',
      playerCount: g.playerCount,
      difficulty: g.settings.difficulty,
      ranks: g.result.ranks.map((r) => ({
        seat: r.seat, collectedCount: r.collectedCount, pairs: r.pairs, score: r.score,
      })),
      myCollected,
      winners: g.result.winners,
      mySeat: 0,
    })
  }

  function restart() {
    fx.settleShow = false
    fx.announcements = []
    const s = normalizeSettings(uni.getStorageSync('echoarray_settings'))
    Object.assign(g.settings, s)
    startGame(g, s.playerCount)
    syncView()
    scheduleAiIfNeeded()
  }

  return {
    view, fx, g, myTurn, interferenceLeft, labelOf,
    selectHand, cancelMode, onArrayTap, restart, skipTurnHuman, sound,
  }
}
