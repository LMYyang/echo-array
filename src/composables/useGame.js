// 单机局管理：真人固定 seat 0，其余座位由 AI 补足。
// core 状态机 + reactive 视图 + AI 延时调度 + 战绩持久化 + 音效/播报钩子。
import { reactive, computed } from 'vue'
import {
  createGame, startGame, flipCard, resolvePair, coverMismatch, coverJoker,
  shiftCard, peekCard, swapJoker, skipTurn, endTurn, viewOf, cancelPending,
} from '../core/game.js'
import { aiChooseAction, aiThinkDelay } from '../core/ai.js'
import { normalizeSettings } from '../core/settings.js'
import { loadStats, saveStats, appendHistory } from './history.js'
import { useSound } from './useSound.js'

const SEAT_LABELS = ['我', '下家', '对家', '上家']
// 收牌动画：飞牌时长（留在视图层）与收尾等待时长（延迟 endTurn，让空槽与飞牌都看得见）
// 单张飞牌 0.95s，第二张延后 120ms 起跳，故 1150ms 后才收尾补牌（回收节奏放慢，看得清）
const COLLECT_FX_MS = 1240
const COLLECT_ANIM_MS = 1150
// 回声移位动画：涟漪 + 被换出的牌飞回牌堆
const SHIFT_FX_MS = 760
// 补牌动画：新补入阵面的牌入场高亮时长
const REFILL_FX_MS = 720

export function useGame() {
  const sound = useSound()
  const settings = normalizeSettings(uni.getStorageSync('echoarray_settings'))
  const g = createGame(Math.random, settings)
  startGame(g, settings.playerCount)

  const fx = reactive({
    mode: 'flip', // flip | replace | peek | swap
    selectedHandId: null,
    targetSlot: null,
    settleShow: false,
    thinking: false,
    peekCard: null,
    lastReason: '',
    announcements: [], // 最近播报文字
    collectFx: null, // 收牌动画快照：{ seat, cards: { [slot]: card }, token }
    shiftFx: null, // 回声移位动画快照：{ slot, card, mode, token }
    refillSlots: [], // 本回合刚补进阵面的槽位，用于播放入场动画
    refillToken: 0,
    busy: false, // 收牌动画/回合收尾期间锁住交互，避免重复行动
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

  /**
   * 收牌动画快照：把「哪个槽位上的哪张牌被谁收走」交给视图层，
   * 视图层用一张与阵面同网格的浮层重绘这两张牌并做飞向收集堆的动画。
   */
  function playCollect(slots, cards, seat) {
    const map = {}
    slots.forEach((s, i) => { if (s != null && cards[i]) map[s] = cards[i] })
    if (!Object.keys(map).length) return
    const token = Date.now() + Math.random()
    fx.collectFx = { seat, cards: map, token }
    setTimeout(() => {
      if (fx.collectFx && fx.collectFx.token === token) fx.collectFx = null
    }, COLLECT_FX_MS)
  }

  /**
   * 回声移位动画快照：目标槽涟漪 + 被换出的牌飞回牌堆。
   * card 为 null 表示原牌本来就没翻开（不能借动画泄露牌面）。
   */
  function playShift(slot, card, mode) {
    const token = Date.now() + Math.random()
    fx.shiftFx = { slot, card: card || null, mode, token }
    setTimeout(() => {
      if (fx.shiftFx && fx.shiftFx.token === token) fx.shiftFx = null
    }, SHIFT_FX_MS)
  }

  /**
   * 补牌动画快照：把"这一批新补进阵面的槽位"交给视图层播放入场动画。
   */
  function playRefill(slots) {
    if (!slots || !slots.length) return
    const token = Date.now() + Math.random()
    fx.refillSlots = slots
    fx.refillToken = token
    setTimeout(() => {
      if (fx.refillToken === token) fx.refillSlots = []
    }, REFILL_FX_MS)
  }

  // ---------- 真人行动 ----------

  /** 点选手牌：普通牌进替换模式；小王进窥视；大王进强换 */
  function selectHand(card) {
    if (!myTurn.value || fx.busy) return
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
  }

  function cancelMode() {
    fx.mode = 'flip'
    fx.selectedHandId = null
    fx.targetSlot = null
  }

  function onArrayTap(slot) {
    if (!myTurn.value || fx.busy) return
    if (fx.mode === 'flip') return doFlip(slot)
    if (fx.mode === 'replace') return doReplaceSelect(slot)
    if (fx.mode === 'peek') return doPeek(slot)
    if (fx.mode === 'swap') return doSwap(slot)
  }

  function doFlip(slot) {
    const res = flipCard(g, 0, slot)
    if (!res.ok) { toast(res.reason); return }
    sound.play(res.claimSlot != null ? 'match' : 'flip')
    if (res.claimSlot != null) announce('和亮牌同点数，直接认领')
    syncView()
    if (res.joker) {
      announce('翻到王牌，盖回原位')
      setTimeout(() => { coverJoker(g); afterAction() }, 1000)
      return
    }
    if (g.pending.stage === 'revealed') {
      setTimeout(() => {
        // 先留快照：resolvePair 会把配对成功的槽位清空，动画需要原始牌面与槽位
        const claimed = !!g.pending.claim
        const slots = [g.pending.first, g.pending.second]
        const cards = slots.map((s) => (g.array[s] ? g.array[s].card : null))
        const r = resolvePair(g)
        syncView()
        if (r.ok && r.matched) {
          sound.play('match')
          announce(claimed ? '认领亮牌，收走两张' : '配对成功，收走两张')
          fx.busy = true
          playCollect(slots, cards, 0)
          setTimeout(afterAction, COLLECT_ANIM_MS)
          return
        }
        if (r.ok && !r.matched) {
          sound.play('miss')
          announce('点数不同，盖回')
          setTimeout(() => { coverMismatch(g); afterAction() }, 900)
        } else {
          afterAction()
        }
      }, 900)
      return
    }

    // 翻开第一张后阵中已没有第二张可翻：盖回并结束本回合，避免卡在「翻牌比对中」
    if (g.pending.stage === 'picked'
      && !g.array.some((s, i) => s && !s.faceUp && i !== slot)) {
      announce('阵中已无第二张可翻，盖回')
      setTimeout(() => { cancelPending(g); syncView(); afterAction() }, 700)
    }
  }

  /** 替换模式第一步：只选改写目标（任意非空槽），投放方式由 submitShift 决定 */
  function doReplaceSelect(slot) {
    const cell = view.array[slot]
    if (!cell) { toast('该槽位为空，无法改写'); return }
    fx.targetSlot = slot
  }

  /** 替换模式第二步：明投 / 暗投 */
  function submitShift(mode) {
    if (!myTurn.value || fx.busy) return
    if (fx.mode !== 'replace' || fx.targetSlot === null) return
    const slot = fx.targetSlot
    const wasFaceUp = !!view.array[slot]?.faceUp
    const res = shiftCard(g, 0, fx.selectedHandId, slot, mode)
    if (!res.ok) { toast(res.reason); cancelMode(); return }
    sound.play('replace')
    announce(mode === 'mute' ? '暗投：一格回声被盖住了' : '明投：一格回声被改写了')
    // 原牌本来没翻开时不给牌面，避免动画泄露
    playShift(slot, wasFaceUp ? res.displaced : null, mode)
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
    if (!myTurn.value || fx.busy) return
    const res = skipTurn(g, 0)
    if (!res.ok) { toast(res.reason); return }
    announce('跳过回合')
    afterAction()
  }

  // ---------- 回合收尾 + AI 调度 ----------

  function afterAction() {
    fx.busy = false
    cancelMode()
    const before = g.array.map((s) => (s ? 1 : 0))
    endTurn(g)
    // 回合末补给：对比收尾前后的阵面，找出刚补进来的槽位播入场动画
    const refilled = g.array.reduce((acc, s, i) => {
      if (s && !before[i]) acc.push(i)
      return acc
    }, [])
    syncView()
    if (refilled.length) playRefill(refilled)
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
      const wait = runAiAction(seat)
      fx.thinking = false
      if (wait > 0) setTimeout(afterAction, wait)
      else afterAction()
    }, aiThinkDelay(g))
  }

  /** 执行一次 AI 行动，返回需要额外等待的毫秒数（配对收牌动画期间延迟收尾） */
  function runAiAction(seat) {
    const choice = aiChooseAction(g, seat)
    switch (choice.action) {
      case 'flip': {
        const [a, b] = choice.slots
        const r1 = flipCard(g, seat, a)
        if (r1.ok && r1.joker) { coverJoker(g); break }
        // 认领：亮牌已被当作第一张，本张是第二张，不再翻 b
        const claimed = r1.ok && r1.claimSlot != null
        if (!claimed) {
          const ok2 = Number.isInteger(b) && g.array[b] && !g.array[b].faceUp
            ? flipCard(g, seat, b).ok
            : false
          if (!ok2 && g.pending.stage === 'picked') {
            cancelPending(g)
            break
          }
        }
        const slots = claimed ? [r1.claimSlot, a] : [a, b]
        const cards = slots.map((s) => (g.array[s] ? g.array[s].card : null))
        const r = resolvePair(g)
        if (r.ok && r.matched) {
          sound.play('match')
          syncView()
          announce(claimed ? '对手认领了亮牌，收走两张' : '对手配对成功')
          playCollect(slots, cards, seat)
          return COLLECT_ANIM_MS
        }
        if (r.ok && !r.matched) coverMismatch(g)
        break
      }
      case 'replace': {
        const wasFaceUp = !!g.array[choice.targetSlot]?.faceUp
        const res = shiftCard(g, seat, choice.handCardId, choice.targetSlot, choice.mode)
        if (res.ok) {
          sound.play('replace')
          announce(choice.mode === 'mute' ? '对手暗投，一格回声被盖住' : '对手明投，一格回声被改写')
          playShift(choice.targetSlot, wasFaceUp ? res.displaced : null, choice.mode)
          syncView()
        }
        break
      }
      case 'peek':
        peekCard(g, seat, choice.handCardId, choice.slot)
        break
      case 'swap':
        swapJoker(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot ?? null)
        break
      default:
        skipTurn(g, seat)
    }
    return 0
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
    selectHand, cancelMode, onArrayTap, submitShift, restart, skipTurnHuman, sound,
  }
}
