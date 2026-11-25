<template>
  <view class="table">
    <!-- 顶栏 -->
    <view class="topbar">
      <button class="btn-home" @click="goHome">‹ 菜单</button>
      <text class="top-title">回声阵</text>
      <view class="top-right">
        <text class="draw-count">牌堆 {{ view.drawCount }}</text>
        <button class="btn-home btn-mute" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
      </view>
    </view>

    <!-- 对手座位 -->
    <view class="opponents">
      <SeatBadge
        v-for="op in view.opponents"
        :key="op.seat"
        :label="labelOf(op.seat)"
        :hand-count="op.handCount"
        :collected-count="op.collectedCount"
        :interference-used="op.interferenceUsed"
        :interference-limit="view.settings?.interferenceLimit ?? 3"
        :active="view.currentSeat === op.seat"
      />
    </view>

    <!-- 回声阵 3×4 -->
    <view class="array-wrap">
      <view class="array-grid">
        <ArrayCard
          v-for="(cell, i) in view.array"
          :key="cell ? cell.slot : `empty-${i}`"
          :cell="cell"
          :selected="fx.targetSlot === (cell && cell.slot)"
          :disabled="!myTurn"
          @tap="onArrayTap(i)"
        />
      </view>
      <view class="turn-hint">
        <text>{{ hintText }}</text>
        <text v-if="fx.mode !== 'flip'" class="cancel-link" @click="cancelMode">取消选择</text>
        <text v-if="myTurn" class="skip-link" @click="skipTurnHuman">跳过回合</text>
      </view>
      <view v-if="lastAnnounce" class="announce">{{ lastAnnounce }}</view>
    </view>

    <!-- 我的座位 + 手牌 -->
    <view class="my-area">
      <SeatBadge
        label="我"
        :hand-count="view.myHand.length"
        :collected-count="view.myCollected.length"
        :interference-used="view.myInterferenceUsed"
        :interference-limit="view.settings?.interferenceLimit ?? 3"
        :active="myTurn"
        is-me
      />
      <view class="hand-row">
        <HandCard
          v-for="card in view.myHand"
          :key="card.id"
          :card="card"
          :selected="fx.selectedHandId === card.id"
          :disabled="!myTurn || (!card.joker && interferenceLeft <= 0)"
          @tap="selectHand(card)"
        />
      </view>
      <view class="my-meta">剩余干扰 {{ interferenceLeft }} 次</view>
    </view>

    <!-- 窥视特写 -->
    <view v-if="fx.peekCard" class="overlay">
      <view class="peek-card">
        <text class="peek-title">你看到了</text>
        <view class="peek-face" :class="fx.peekCard.color">
          <text class="peek-rank">{{ fx.peekCard.label }}</text>
          <text class="peek-suit">{{ fx.peekCard.suitLabel }}</text>
        </view>
      </view>
    </view>

    <!-- 结算弹层 -->
    <view v-if="fx.settleShow && view.result" class="overlay">
      <view class="settle-card">
        <text class="settle-title">{{ iAmWinner ? '🏆 恭喜获胜' : '本局结束' }}</text>
        <SettleList :result="view.result" :label-of="labelOf" />
        <view class="settle-actions">
          <button class="btn-primary" @click="restart">再来一局</button>
          <button class="btn-secondary" @click="goHome">返回菜单</button>
        </view>
      </view>
    </view>

    <!-- 新手教学遮罩 -->
    <view v-if="guide.active.value" class="guide-overlay">
      <view class="guide-card">
        <text class="guide-zone">{{ guide.current().title }}</text>
        <text class="guide-text">{{ guide.current().text }}</text>
        <view class="guide-actions">
          <button class="btn-secondary" @click="guide.skip">跳过教学</button>
          <button class="btn-primary" @click="guide.next">{{ guide.step.value === guide.steps.length - 1 ? '完成' : '下一步' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useGame } from '../../composables/useGame.js'
import { useNetGame } from '../../composables/useNetGame.js'
import { useGuide } from '../../composables/useGuide.js'
import { useSound } from '../../composables/useSound.js'
import ArrayCard from '../../components/ArrayCard.vue'
import HandCard from '../../components/HandCard.vue'
import SeatBadge from '../../components/SeatBadge.vue'
import SettleList from '../../components/SettleList.vue'

const emptyView = {
  state: '', currentSeat: 0, array: [], drawCount: 0, myHand: [], myCollected: [],
  myInterferenceUsed: 0, opponents: [], settings: null, result: null,
}
const emptyFx = { mode: 'flip', selectedHandId: null, targetSlot: null, emptySlot: null, settleShow: false, thinking: false, peekCard: null, announcements: [] }

const mode = ref('solo')
let api = null

// ref 持有对局实例的视图/ fx 代理引用：挂载后赋值触发模板重算
const viewSource = ref(emptyView)
const fxSource = ref(emptyFx)
const view = computed(() => viewSource.value)
const fx = computed(() => fxSource.value)

const myTurn = computed(() => !!api?.myTurn?.value)
const interferenceLeft = computed(() => api?.interferenceLeft?.value ?? 0)
const labelOf = (seat) => api?.labelOf(seat) || `座位${seat}`
const lastAnnounce = computed(() => fx.value.announcements?.slice(-1)[0]?.text || '')
const iAmWinner = computed(() => !!(view.value.result && view.value.result.winners.includes(api?.mySeat ?? 0)))

function selectHand(card) { api?.selectHand(card) }
function cancelMode() { api?.cancelMode() }
function onArrayTap(i) { api?.onArrayTap(i) }
function skipTurnHuman() { api?.skipTurnHuman() }
async function restart() { await api?.restart() }

const guide = useGuide()
const sound = useSound()
const muted = sound.muted
function toggleMute() { sound.toggleMute() }

const hintText = computed(() => {
  if (view.value.state !== 'PLAYING') return ''
  if (!myTurn.value) return fx.value.thinking ? '对手思考中…' : '等待对手行动'
  if (fx.value.mode === 'replace') {
    return fx.value.targetSlot === null ? '选择一张已翻开的牌作为替换目标' : '选择一个空位作为落点'
  }
  if (fx.value.mode === 'peek') return '选择一张背面朝上的牌窥视'
  if (fx.value.mode === 'swap') return '选择一张牌进行强换'
  return '点击背面牌翻牌配对'
})

onLoad((query) => { mode.value = query?.mode === 'net' ? 'net' : 'solo' })

onMounted(() => {
  api = mode.value === 'net' ? useNetGame() : useGame()
  viewSource.value = api.view
  fxSource.value = api.fx
  sound.startBgm()
})
onUnmounted(() => { sound.stopBgm() })

function goHome() {
  if (mode.value === 'net') {
    api?.leave?.()
    uni.reLaunch({ url: '/pages/lobby/lobby' })
  } else {
    uni.reLaunch({ url: '/pages/index/index' })
  }
}
</script>

<style scoped>
.table { min-height: 100vh; display: flex; flex-direction: column; padding: 24rpx 28rpx 32rpx; box-sizing: border-box; gap: 20rpx; }

.topbar { display: flex; align-items: center; justify-content: space-between; }
.top-title { font-size: 32rpx; font-weight: bold; color: #eef2ff; letter-spacing: 4rpx; }
.top-right { display: flex; align-items: center; gap: 16rpx; }
.draw-count { font-size: 22rpx; color: #9aa4c0; }
.btn-home { font-size: 24rpx; padding: 10rpx 24rpx; margin: 0; background: rgba(255,255,255,0.06); color: #c6cde4; border-radius: 12rpx; border: 2rpx solid rgba(255,255,255,0.08); }
.btn-mute { padding: 10rpx 16rpx; }

.opponents { display: flex; gap: 16rpx; flex-wrap: wrap; }

.array-wrap { display: flex; flex-direction: column; gap: 16rpx; }
.array-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; }
.turn-hint { display: flex; align-items: center; justify-content: center; gap: 16rpx; min-height: 32rpx; text-align: center; font-size: 24rpx; color: #9aa4c0; }
.cancel-link { color: #2fb9c9; font-size: 22rpx; }
.skip-link { color: #9aa4c0; font-size: 22rpx; text-decoration: underline; }
.announce { text-align: center; font-size: 22rpx; color: #2fb9c9; min-height: 28rpx; }

.my-area { display: flex; flex-direction: column; gap: 16rpx; margin-top: auto; }
.hand-row { display: flex; gap: 16rpx; flex-wrap: wrap; justify-content: center; }
.my-meta { text-align: center; font-size: 22rpx; color: #9aa4c0; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 99; }
.peek-card { background: #1a2338; border: 2rpx solid #2fb9c9; border-radius: 24rpx; padding: 32rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; }
.peek-title { font-size: 26rpx; color: #9aa4c0; }
.peek-face { width: 120rpx; height: 160rpx; border-radius: 16rpx; background: linear-gradient(145deg,#f5f1e6,#ddd5c0); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; }
.peek-face.red { color: #c0392b; }
.peek-face.black { color: #1a1a1a; }
.peek-rank { font-size: 40rpx; font-weight: 700; }
.peek-suit { font-size: 28rpx; }

.settle-card { background: #1a2338; border: 2rpx solid rgba(47,185,201,0.3); border-radius: 24rpx; padding: 32rpx 28rpx; width: 640rpx; max-width: 90vw; display: flex; flex-direction: column; gap: 24rpx; }
.settle-title { font-size: 36rpx; font-weight: bold; color: #eef2ff; text-align: center; }
.settle-actions { display: flex; gap: 20rpx; }
.settle-actions .btn-primary, .settle-actions .btn-secondary { flex: 1; margin: 0; }

.guide-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 98; padding: 0 40rpx 60rpx; }
.guide-card { background: #1a2338; border: 2rpx solid #2fb9c9; border-radius: 24rpx; padding: 28rpx; width: 100%; max-width: 640rpx; display: flex; flex-direction: column; gap: 16rpx; }
.guide-zone { font-size: 30rpx; font-weight: bold; color: #2fb9c9; }
.guide-text { font-size: 26rpx; color: #c6cde4; line-height: 1.7; }
.guide-actions { display: flex; gap: 20rpx; justify-content: flex-end; }
.guide-actions .btn-primary, .guide-actions .btn-secondary { margin: 0; }
</style>
