<template>
  <view class="room">
    <view class="head">
      <text class="room-id">房间号 {{ roomId }}</text>
      <text class="hint">全员准备后开局，空位自动补 AI</text>
    </view>
    <view class="seats">
      <view
        v-for="seat in [0, 1, 2, 3]"
        :key="seat"
        class="seat"
        :class="{ me: seat === mySeat, taken: !!memberOf(seat), host: memberOf(seat)?.isHost }"
        @click="tapSeat(seat)"
      >
        <text class="seat-no">{{ seat + 1 }}号位{{ seat === mySeat ? '（我）' : '' }}</text>
        <view v-if="memberOf(seat)?.isHost" class="host-badge">
          <text class="host-badge-star">✦</text>
          <text class="host-badge-text">房主</text>
        </view>
        <text
          v-else-if="isHost && memberOf(seat) && !memberOf(seat).isAI"
          class="seat-kick"
          @click.stop="kick(memberOf(seat))"
        >移出</text>
        <view class="seat-name-row">
          <text class="seat-name">{{ memberOf(seat)?.name || '空位' }}</text>
        </view>
        <view v-if="memberOf(seat)" class="seat-status-row">
          <text class="seat-status">
            {{ memberOf(seat).isAI ? 'AI 代打' : seatReadyText(memberOf(seat)) }}{{ memberOf(seat).connected ? '' : ' · 掉线' }}
          </text>
          <text
            v-if="isHost && !roomSettling && !memberOf(seat).isAI && !memberOf(seat).ready && memberOf(seat).connected"
            class="seat-poke"
            @click.stop="poke(memberOf(seat))"
          >提醒准备</text>
        </view>
        <text v-if="!memberOf(seat)" class="seat-status">点击入座</text>
      </view>
    </view>
    <view class="actions">
      <view class="settings-entry" @click="openSettings">
        <view class="settings-title-row">
          <text class="settings-title">对局设置</text>
          <text class="settings-arrow">›</text>
        </view>
        <text class="settings-summary">{{ settingsSummary }}</text>
      </view>
      <button v-if="isHost" class="btn-primary start-btn" :disabled="!canStart" @click="start">{{ startHint }}</button>
      <button v-if="myMember && !isHost && !myMember.ready && !roomSettling" class="btn-secondary" @click="setReady(true)">准备</button>
      <button v-else-if="myMember && !isHost && (myMember.ready || roomSettling)" class="btn-secondary" @click="setReady(false)">取消准备</button>
      <button class="btn-leave" @click="leave">离开房间</button>
    </view>
    <view v-if="pokeShow" class="poke-overlay" @click="pokeShow = false">
      <view class="poke-card" @click.stop>
        <text class="poke-title">✦ 提醒 ✦</text>
        <text class="poke-text">{{ pokeMessage }}</text>
        <button class="btn-primary poke-btn" @click="pokeShow = false">知道了</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { sharedNet } from '../../utils/net.js'

const net = sharedNet()
const roomId = ref(null)
const room = ref(null)
const mySeat = ref(null)
const redirected = ref(false)
const roomSettling = computed(() => room.value?.settling || false)

const offRoom = net.on('room.state', ({ room: r }) => {
  room.value = r
  roomId.value = r.roomId
  if (r.state === 'WAITING') redirected.value = false
  if (r.state === 'WAITING' && mySeat.value === null) restoreSession()
})
const offKicked = net.on('kicked', () => {
  uni.removeStorageSync('echoarray_player_token')
  uni.showToast({ title: '你已被房主移出房间', icon: 'none' })
  uni.reLaunch({ url: '/pages/lobby/lobby' })
})
const pokeShow = ref(false)
const pokeMessage = ref('')
const offPoke = net.on('poke', ({ message }) => {
  pokeMessage.value = message || '房主提醒你准备'
  pokeShow.value = true
})
const offStart = net.on('game.state', ({ view }) => {
  if (!view || view.state === 'SETTLE') return
  if (redirected.value) return
  redirected.value = true
  uni.redirectTo({ url: '/pages/game/game?mode=net' })
})

function memberOf(seat) { return room.value?.members.find((m) => m.seat === seat) || null }
const myMember = computed(() => (mySeat.value === null ? null : memberOf(mySeat.value)))
const isHost = computed(() => myMember.value?.isHost || false)
const canStart = computed(() => {
  if (!room.value || roomSettling.value) return false
  const real = room.value.members.filter((m) => !m.isAI)
  return real.length > 0 && real.every((m) => m.ready)
})
const startHint = computed(() => {
  if (roomSettling.value) return '等待其他玩家结算完成…'
  if (canStart.value) return '开始游戏'
  const real = room.value ? room.value.members.filter((m) => !m.isAI) : []
  const unready = real.filter((m) => !m.ready).length
  if (unready > 0) return `还差${unready}人准备·空位AI补齐`
  return '可开始·空位AI补齐'
})
const seatReadyText = (m) =>
  m.isAI ? '' : roomSettling.value && !m.settled ? '结算中' : m.ready ? '已准备' : '未准备'

const DIFF_LABEL = { easy: '简单', normal: '普通', hard: '困难' }
const settingsSummary = computed(() => {
  const s = room.value?.settings
  if (!s) return ''
  return `${s.playerCount} 人 · ${DIFF_LABEL[s.difficulty] || s.difficulty} · 干扰限 ${s.interferenceLimit} 次`
})

function openSettings() {
  const s = room.value?.settings || {}
  const q = `mode=net&host=${isHost.value ? 1 : 0}&s=${encodeURIComponent(JSON.stringify(s))}`
  uni.navigateTo({ url: `/pages/settings/settings?${q}` })
}

function handleRoomError(res, fallback = '请求失败') {
  const code = res?.payload?.code
  const message = res?.payload?.message || fallback
  if (code === 'ROOM_GONE') {
    uni.removeStorageSync('echoarray_player_token')
    uni.showToast({ title: message, icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/lobby/lobby' }), 1500)
    return
  }
  uni.showToast({ title: message, icon: 'none' })
}

async function tapSeat(seat) {
  if (!room.value || mySeat.value === null) return
  if (seat === mySeat.value || memberOf(seat)) return
  if (roomSettling.value) { uni.showToast({ title: '结算中，稍后再换座位', icon: 'none' }); return }
  try {
    const res = await net.request('room.seat', { seat })
    if (res.type === 'error') handleRoomError(res)
    else mySeat.value = seat
  } catch (e) {
    uni.showToast({ title: e.message || '请求失败', icon: 'none' })
  }
}
async function setReady(ready) {
  if (roomSettling.value) {
    if (ready) {
      try { const res = await net.request('game.settleContinue', {}) ; if (res.type === 'error') handleRoomError(res) }
      catch (e) { uni.showToast({ title: e.message || '请求失败', icon: 'none' }) }
    }
    return
  }
  try {
    const res = await net.request('room.ready', { ready })
    if (res.type === 'error') handleRoomError(res)
  } catch (e) {
    uni.showToast({ title: e.message || '请求失败', icon: 'none' })
  }
}
async function kick(member) {
  if (roomSettling.value) { uni.showToast({ title: '结算中，稍后再操作', icon: 'none' }); return }
  try {
    const res = await net.request('room.kick', { token: member.token })
    if (res.type === 'error') handleRoomError(res)
  } catch (e) {
    uni.showToast({ title: e.message || '请求失败', icon: 'none' })
  }
}
async function poke(member) {
  if (roomSettling.value) return
  try {
    const res = await net.request('room.poke', { token: member.token })
    if (res.type === 'error') handleRoomError(res)
    else uni.showToast({ title: '已提醒', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: e.message || '请求失败', icon: 'none' })
  }
}
async function start() {
  try {
    const res = await net.request('game.start', {})
    if (res.type === 'error') handleRoomError(res)
  } catch (e) {
    uni.showToast({ title: e.message || '请求失败', icon: 'none' })
  }
}
async function leave() {
  try { await net.request('room.leave', {}) } catch { /* 服务器 sweep 兜底 */ }
  uni.removeStorageSync('echoarray_player_token')
  uni.reLaunch({ url: '/pages/lobby/lobby' })
}

let restoring = false
async function restoreSession() {
  if (restoring) return
  restoring = true
  try {
    const token = uni.getStorageSync('echoarray_player_token')
    if (!token) { uni.reLaunch({ url: '/pages/lobby/lobby' }); return }
    try {
      if (net.status.value !== 'open') await net.connect()
      const res = await net.request('reconnect', { token })
      if (res.type === 'error') {
        uni.removeStorageSync('echoarray_player_token')
        uni.reLaunch({ url: '/pages/lobby/lobby' })
        return
      }
      room.value = res.payload.room
      mySeat.value = res.payload.yourSeat
      roomId.value = res.payload.room.roomId
    } catch (e) {
      uni.showToast({ title: e.message || '连接失败', icon: 'none' })
      uni.reLaunch({ url: '/pages/lobby/lobby' })
    }
  } finally {
    restoring = false
  }
}

onLoad(async (query) => {
  roomId.value = Number(query.roomId)
  await restoreSession()
})

watch(net.status, async (val, old) => {
  if (val !== 'open' || old !== 'reconnecting') return
  await restoreSession()
})
onUnmounted(() => { offRoom?.(); offStart?.(); offKicked?.(); offPoke?.() })
</script>

<style scoped>
.room { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 80rpx 40rpx 60rpx; gap: 40rpx; box-sizing: border-box; }
.head { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.room-id { font-size: 56rpx; font-weight: bold; color: #2fb9c9; letter-spacing: 8rpx; }
.hint { font-size: 24rpx; color: #9aa4c0; }
.seats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; width: 100%; max-width: 700rpx; }
.seat { position: relative; box-sizing: border-box; padding: 28rpx 24rpx; border-radius: 16rpx; background: rgba(26,35,56,0.5); border: 2rpx solid #3a4666; display: flex; flex-direction: column; gap: 8rpx; }
.seat.me { border-color: #2fb9c9; }
.seat.host { border-color: #2fb9c9; border-width: 4rpx; background: linear-gradient(160deg, rgba(47,185,201,0.18), rgba(26,35,56,0.5)); }
.seat.host .seat-name { color: #2fb9c9; }
.seat.taken { background: rgba(38,50,78,0.7); }
.seat-no { font-size: 22rpx; color: #9aa4c0; }
.seat-name { font-size: 32rpx; color: #eef2ff; }
.seat-name-row { display: flex; align-items: center; min-width: 0; padding-right: 100rpx; }
.seat-name-row .seat-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.host-badge { position: absolute; top: 12rpx; right: 12rpx; display: flex; align-items: center; gap: 4rpx; padding: 2rpx 12rpx; border: 2rpx solid #2fb9c9; border-radius: 999rpx; background: rgba(47,185,201,0.14); }
.host-badge-star { font-size: 20rpx; color: #2fb9c9; line-height: 1; }
.host-badge-text { font-size: 20rpx; color: #2fb9c9; line-height: 1.4; }
.seat-status { font-size: 22rpx; color: #9aa4c0; }
.seat-kick { position: absolute; top: 12rpx; right: 12rpx; font-size: 22rpx; color: #c0563a; padding: 4rpx 8rpx; }
.seat-status-row { display: flex; align-items: center; gap: 12rpx; }
.seat-poke { margin-left: auto; font-size: 22rpx; color: #2fb9c9; padding: 2rpx 12rpx; border: 2rpx solid #2fb9c9; border-radius: 999rpx; flex: none; }
.actions { display: flex; flex-direction: column; align-items: center; gap: 20rpx; width: 100%; max-width: 560rpx; margin-top: 20rpx; }
.settings-entry { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 10rpx; padding: 24rpx 28rpx; background: #26324e; border: 2rpx solid #3a4666; border-radius: 24rpx; }
.settings-title-row { display: flex; align-items: center; justify-content: space-between; }
.settings-title { font-size: 30rpx; color: #eef2ff; font-weight: bold; }
.settings-arrow { font-size: 32rpx; color: #9aa4c0; line-height: 1; }
.settings-summary { font-size: 26rpx; color: #9aa4c0; }
.start-btn { width: auto; min-width: 0; padding: 18rpx 64rpx; font-size: 32rpx; white-space: nowrap; line-height: 1.4; }
.btn-leave { background: transparent; color: #9aa4c0; border: 2rpx solid #3a4666; }
.poke-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 99; }
.poke-card { background: rgba(38,50,78,0.88); border-radius: 24rpx; padding: 48rpx 40rpx; width: 560rpx; display: flex; flex-direction: column; gap: 24rpx; align-items: center; box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.5); border: 2rpx solid #3a4666; }
.poke-title { font-size: 36rpx; font-weight: bold; color: #2fb9c9; letter-spacing: 4rpx; }
.poke-text { font-size: 30rpx; color: #eef2ff; text-align: center; }
.poke-btn { width: auto; padding: 14rpx 56rpx; }
</style>
