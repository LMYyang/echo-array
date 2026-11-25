// 联网局管理：接口与 useGame 一致，数据源为服务器推送。
// 挂载后主动拉一次快照（reconnect 携带存储 token），否则开局推送本页收不到。
import { reactive, computed, ref, watch, getCurrentInstance, onUnmounted } from 'vue'
import { sharedNet } from '../utils/net.js'
import { appendHistory } from './history.js'
import { useSound } from './useSound.js'

export function useNetGame(net = sharedNet()) {
  const sound = useSound()
  const view = reactive({
    state: '', playerCount: 0, currentSeat: null, turnNo: 1,
    array: [], drawCount: 0, myHand: [], myCollected: [], myInterferenceUsed: 0,
    opponents: [], settings: null, result: null,
  })
  const fx = reactive({
    mode: 'flip', selectedHandId: null, targetSlot: null,
    settleShow: false, thinking: false, peekCard: null, lastReason: '', announcements: [],
  })
  const connection = net.status
  let stopWatch = null
  const roomId = ref(null)
  const mySeat = ref(0)
  const names = reactive({})

  const applyView = (v) => {
    if (!v) return
    Object.keys(v).forEach((k) => { view[k] = v[k] })
  }

  const offState = net.on('game.state', ({ view: v, fx: f, roomId: rid, yourSeat, names: n }) => {
    applyView(v)
    Object.assign(fx, { settleShow: false }, f || {})
    if (rid !== undefined) roomId.value = rid
    if (yourSeat !== undefined) mySeat.value = yourSeat
    if (n) Object.assign(names, n)
  })
  const offOver = net.on('game.over', ({ result, view: v }) => {
    applyView(v)
    view.result = result
    saveNetHistory(result)
  })

  function saveNetHistory(result) {
    appendHistory({
      mode: 'net',
      roomId: roomId.value ?? null,
      ranks: (result?.ranks || []).map((r) => ({
        seat: r.seat, collectedCount: r.collectedCount, pairs: r.pairs, score: r.score,
      })),
      myCollected: (view.myCollected || []).length,
      winners: result?.winners || [],
      mySeat: mySeat.value,
      names: { ...names },
    })
  }

  if (getCurrentInstance()) onUnmounted(() => { offState(); offOver(); stopWatch?.() })

  async function fetchSnapshot() {
    try {
      if (net.status.value !== 'open') await net.connect()
      const token = uni.getStorageSync('echoarray_player_token')
      const res = await net.request('reconnect', { token })
      if (res.type === 'error') return
    } catch { /* 快照缺失仅表现为空桌面 */ }
  }
  fetchSnapshot()
  if (getCurrentInstance()) {
    stopWatch = watch(connection, (s) => { if (s === 'open') fetchSnapshot() })
    onUnmounted(() => stopWatch?.())
  }

  const labelOf = (seat) => (seat === mySeat.value ? '我' : names[seat] || `座位${seat}`)
  const myTurn = computed(() => view.state === 'PLAYING' && view.currentSeat === mySeat.value)
  const interferenceLeft = computed(() => (view.settings?.interferenceLimit ?? 3) - view.myInterferenceUsed)

  function announce(text) {
    if (!text) return
    fx.announcements.push({ id: Date.now() + Math.random(), text })
    if (fx.announcements.length > 4) fx.announcements.shift()
    sound.announce(text)
  }

  /** 统一请求出口：type==='error' 回执视为失败 */
  async function call(type, payload) {
    try {
      const res = await net.request(type, payload)
      if (res && res.type === 'error') {
        return { ok: false, reason: res.payload?.message || '操作失败', code: res.payload?.code }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e.message }
    }
  }

  function toast(reason) { if (reason) uni.showToast({ title: reason, icon: 'none' }) }

  // ---------- 行动（与单机 UI 同一套交互路由） ----------

  function selectHand(card) {
    if (!myTurn.value) return
    if (!card.joker && interferenceLeft.value <= 0) { toast('本局干扰次数已用完'); return }
    if (card.joker === 'SJ') fx.mode = 'peek'
    else if (card.joker === 'BJ') fx.mode = 'swap'
    else fx.mode = 'replace'
    fx.selectedHandId = card.id
    fx.targetSlot = null
  }

  function cancelMode() {
    fx.mode = 'flip'; fx.selectedHandId = null; fx.targetSlot = null
  }

  function onArrayTap(slot) {
    if (!myTurn.value) return
    if (fx.mode === 'flip') return call('game.flip', { slot })
    if (fx.mode === 'replace') return doReplaceSelect(slot)
    if (fx.mode === 'peek') return doPeek(slot)
    if (fx.mode === 'swap') return doSwap(slot)
  }

  /** 替换模式第一步：选任意非空槽作为改写目标 */
  function doReplaceSelect(slot) {
    if (!view.array[slot]) { toast('该槽位为空，无法改写'); return }
    fx.targetSlot = slot
  }

  /** 替换模式第二步：明投 / 暗投 */
  async function submitShift(mode) {
    if (fx.mode !== 'replace' || fx.targetSlot === null) return
    const res = await call('game.replace', {
      handCardId: fx.selectedHandId, targetSlot: fx.targetSlot, mode,
    })
    if (!res.ok) { toast(res.reason); cancelMode(); return }
    announce(mode === 'mute' ? '暗投：一格回声被盖住了' : '明投：一格回声被改写了')
    cancelMode()
  }

  function doPeek(slot) {
    call('game.peek', { handCardId: fx.selectedHandId, slot })
    cancelMode()
  }

  function doSwap(slot) {
    const empty = view.array.findIndex((c) => c === null)
    call('game.swap', { handCardId: fx.selectedHandId, targetSlot: slot, emptySlot: empty >= 0 ? empty : null })
    cancelMode()
  }

  function skipTurnHuman() { call('game.skip', {}) }

  async function restart() {
    const res = await call('game.settleContinue', {})
    return res.ok
  }

  async function leave() {
    try { await net.request('room.leave', {}) } catch { /* 服务器宽限兜底 */ }
  }

  return {
    view, fx, myTurn, interferenceLeft, labelOf,
    selectHand, cancelMode, onArrayTap, submitShift, restart, skipTurnHuman,
    connection, roomId, mySeat, leave, sound,
  }
}
