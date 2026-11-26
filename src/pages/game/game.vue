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

    <!-- 对手座位：固定一行，从左到右 上家 → 对家 → 下家 -->
    <view class="opponents">
      <view v-for="op in orderedOpponents" :key="op.seat" class="op-cell">
        <SeatBadge
          :label="labelOf(op.seat)"
          :hand-count="op.handCount"
          :collected-count="op.collectedCount"
          :interference-used="op.interferenceUsed"
          :interference-limit="view.settings?.interferenceLimit ?? 3"
          :active="view.currentSeat === op.seat"
          :bump="isCollectSeat(op.seat)"
          compact
        />
      </view>
    </view>

    <!-- 回声阵 3×4 -->
    <view class="array-wrap">
      <view class="array-stage">
        <view class="array-grid">
          <ArrayCard
            v-for="(cell, i) in view.array"
            :key="cell ? cell.slot : `empty-${i}`"
            :cell="cell"
            :selected="fx.targetSlot === (cell && cell.slot)"
            :disabled="!myTurn"
            :refill="fx.refillSlots?.includes(i) ?? false"
            @tap="onArrayTap(i)"
          />
        </view>
        <!-- 收牌动画层：与阵面同网格叠放，重绘上一步亮出的两张牌并飞向收集堆 -->
        <view v-if="fx.collectFx" class="collect-layer">
          <view v-for="i in 12" :key="`fly-${i}`" class="collect-cell">
            <view
              v-if="flyCard(i - 1)"
              class="fly-card"
              :class="[flyCard(i - 1).color, collectDir]"
              :style="{ animationDelay: flyDelay(i - 1) }"
            >
              <text class="fly-rank">{{ flyCard(i - 1).label }}</text>
              <text class="fly-suit">{{ flyCard(i - 1).suitLabel }}</text>
            </view>
          </view>
        </view>
        <!-- 回声移位动画层：目标槽涟漪 + 被换出的牌飞回牌堆 -->
        <view v-if="fx.shiftFx" class="shift-layer">
          <view v-for="i in 12" :key="`shift-${i}`" class="collect-cell">
            <view v-if="fx.shiftFx.slot === i - 1" class="shift-anchor">
              <view class="shift-ripple" :class="fx.shiftFx.mode" />
              <view v-if="fx.shiftFx.card" class="shift-away" :class="fx.shiftFx.card.color">
                <text class="fly-rank">{{ fx.shiftFx.card.label }}</text>
                <text class="fly-suit">{{ fx.shiftFx.card.suitLabel }}</text>
              </view>
              <view v-else class="shift-away shift-hidden" />
            </view>
          </view>
        </view>
      </view>
      <view class="turn-hint">
        <text>{{ hintText }}</text>
        <text v-if="fx.mode !== 'flip'" class="cancel-link" @click="cancelMode">取消选择</text>
        <text v-if="myTurn" class="skip-link" @click="skipTurnHuman">跳过回合</text>
      </view>
      <!-- 明投 / 暗投 二选一 -->
      <view v-if="fx.mode === 'replace' && fx.targetSlot !== null" class="shift-bar">
        <view class="shift-act loud" @click="submitShift('loud')">
          <text class="act-name">明投</text>
          <text class="act-desc">牌面朝上，全场可见</text>
        </view>
        <view class="shift-act mute" @click="submitShift('mute')">
          <text class="act-name">暗投</text>
          <text class="act-desc">牌面朝下，只有你知道</text>
        </view>
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
        :bump="isCollectSeat(mySeat)"
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
import { computed, ref, shallowRef, onMounted, onUnmounted } from 'vue'
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
const emptyFx = { mode: 'flip', selectedHandId: null, targetSlot: null, settleShow: false, thinking: false, peekCard: null, announcements: [] }

const mode = ref('solo')
// 用 shallowRef 持有对局实例：api 在 onMounted 才赋值，非响应式变量会让下面的 computed 永远停在初始值
const api = shallowRef(null)

// ref 持有对局实例的视图/ fx 代理引用：挂载后赋值触发模板重算
const viewSource = ref(emptyView)
const fxSource = ref(emptyFx)
const view = computed(() => viewSource.value)
const fx = computed(() => fxSource.value)

const mySeat = computed(() => api.value?.mySeat?.value ?? 0)
// 一律从 view 上的真实状态推导，保证挂载后立即显示正确数值（联网局 currentSeat 为绝对座位）
const myTurn = computed(() => view.value.state === 'PLAYING' && view.value.currentSeat === mySeat.value)
const interferenceLimit = computed(() => view.value.settings?.interferenceLimit ?? 3)
const interferenceLeft = computed(() => Math.max(0, interferenceLimit.value - (view.value.myInterferenceUsed ?? 0)))
const labelOf = (seat) => api.value?.labelOf(seat) || `座位${seat}`
const lastAnnounce = computed(() => fx.value.announcements?.slice(-1)[0]?.text || '')
const iAmWinner = computed(() => !!(view.value.result && view.value.result.winners.includes(mySeat.value)))
// 对手座位按牌桌方位排：上家 → 对家 → 下家（view.opponents 是按下家、对家、上家的座位顺序给的，这里倒序）
const orderedOpponents = computed(() => [...(view.value.opponents || []).slice().reverse()])

// 收牌动画：正在飞向收集堆的牌与方向（我 → 向下飞进收集堆；对手 → 向上飞回座位）
const collectDir = computed(() => (fx.value.collectFx && fx.value.collectFx.seat === mySeat.value ? 'fly-down' : 'fly-up'))
const flySlots = computed(() => (fx.value.collectFx ? Object.keys(fx.value.collectFx.cards).map(Number) : []))
function flyDelay(slot) {
  const idx = flySlots.value.indexOf(slot)
  return `${idx > 0 ? 120 : 0}ms`
}
function flyCard(slot) { return fx.value.collectFx ? fx.value.collectFx.cards[slot] : null }
function isCollectSeat(seat) { return !!(fx.value.collectFx && fx.value.collectFx.seat === seat) }

function selectHand(card) { api.value?.selectHand(card) }
function cancelMode() { api.value?.cancelMode() }
function onArrayTap(i) { api.value?.onArrayTap(i) }
function submitShift(mode) { api.value?.submitShift(mode) }
function skipTurnHuman() { api.value?.skipTurnHuman() }
async function restart() { await api.value?.restart() }

const guide = useGuide()
const sound = useSound()
const muted = sound.muted
function toggleMute() { sound.toggleMute() }

const hintText = computed(() => {
  if (view.value.state !== 'PLAYING') return ''
  if (!myTurn.value) return fx.value.thinking ? '对手思考中…' : '等待对手行动'
  if (fx.value.mode === 'replace') {
    return fx.value.targetSlot === null
      ? '点任意一个槽位作为改写目标（正面牌更值得改写）'
      : `目标第 ${fx.value.targetSlot + 1} 格 · 选择明投或暗投`
  }
  if (fx.value.mode === 'peek') return '选择一张背面朝上的牌窥视'
  if (fx.value.mode === 'swap') return '选择一张牌进行强换'
  return '点击背面牌翻牌配对'
})

onLoad((query) => { mode.value = query?.mode === 'net' ? 'net' : 'solo' })

onMounted(() => {
  api.value = mode.value === 'net' ? useNetGame() : useGame()
  viewSource.value = api.value.view
  fxSource.value = api.value.fx
  sound.startBgm()
  // 第一次点击时静默预热 TTS，避免部分浏览器把首句播报当成「无手势」拦掉
  if (typeof document !== 'undefined') {
    const prime = () => {
      sound.primeSpeech?.()
      document.removeEventListener('pointerdown', prime)
    }
    document.addEventListener('pointerdown', prime)
  }
})
onUnmounted(() => { sound.stopBgm(); sound.stopSpeech?.() })

function goHome() {
  if (mode.value === 'net') {
    api.value?.leave?.()
    uni.reLaunch({ url: '/pages/lobby/lobby' })
  } else {
    uni.reLaunch({ url: '/pages/index/index' })
  }
}
</script>

<style scoped>
.table { min-height: 100vh; display: flex; flex-direction: column; padding: 24rpx 28rpx 32rpx; box-sizing: border-box; gap: 20rpx; max-width: 820px; margin: 0 auto; }

.topbar { display: flex; align-items: center; justify-content: space-between; }
.top-title { font-size: 32rpx; font-weight: bold; color: #eef2ff; letter-spacing: 4rpx; }
.top-right { display: flex; align-items: center; gap: 16rpx; }
.draw-count { font-size: 22rpx; color: #9aa4c0; }
.btn-home { font-size: 24rpx; padding: 10rpx 24rpx; margin: 0; background: rgba(255,255,255,0.06); color: #c6cde4; border-radius: 12rpx; border: 2rpx solid rgba(255,255,255,0.08); }
.btn-mute { padding: 10rpx 16rpx; }

.opponents { display: flex; gap: 12rpx; flex-wrap: nowrap; align-items: stretch; justify-content: center; }
.op-cell { flex: 1 1 0; min-width: 0; max-width: 360rpx; display: flex; }
.op-cell :deep(.seat) { width: 100%; }

.array-wrap { display: flex; flex-direction: column; gap: 16rpx; }
.array-stage { position: relative; }
.array-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; }

/* 收牌动画层：同列宽、同间距、同宽高比，保证飞牌起点与阵面槽位严丝合缝 */
.collect-layer { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; pointer-events: none; z-index: 6; }
.collect-cell { position: relative; width: 100%; aspect-ratio: 3 / 4; }
.fly-card {
  position: absolute; inset: 0; border-radius: 14rpx;
  background: linear-gradient(145deg, #f5f1e6, #ddd5c0);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4rpx;
  box-shadow: 0 10rpx 26rpx rgba(0, 0, 0, 0.5);
  animation: flyDown 0.95s cubic-bezier(0.42, 0.02, 0.52, 1) both;
}
.fly-card.fly-up { animation-name: flyUp; }
.fly-card.red { color: #c0392b; }
.fly-card.black { color: #1a1a1a; }
.fly-rank { font-size: 34rpx; font-weight: 700; line-height: 1; }
.fly-suit { font-size: 24rpx; line-height: 1; }
@keyframes flyDown {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  16% { transform: translateY(-18rpx) scale(1.09); opacity: 1; }
  100% { transform: translateY(260rpx) scale(0.34) rotate(6deg); opacity: 0; }
}
@keyframes flyUp {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  16% { transform: translateY(16rpx) scale(1.09); opacity: 1; }
  100% { transform: translateY(-240rpx) scale(0.34) rotate(-6deg); opacity: 0; }
}

/* 回声移位层：目标槽涟漪 + 被换出的牌飞回牌堆（原牌未翻开时只给灰背面） */
.shift-layer { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; pointer-events: none; z-index: 7; }
.shift-anchor { position: absolute; inset: 0; }
.shift-ripple { position: absolute; inset: -10rpx; border-radius: 18rpx; border: 4rpx solid rgba(47,185,201,0.55); animation: rippleOut 0.62s ease-out both; }
.shift-ripple.mute { border-color: rgba(123,109,199,0.7); }
.shift-away {
  position: absolute; inset: 0; border-radius: 14rpx;
  background: linear-gradient(145deg, #f5f1e6, #ddd5c0);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4rpx;
  box-shadow: 0 10rpx 26rpx rgba(0, 0, 0, 0.45);
  animation: shiftBack 0.7s ease-in both;
}
.shift-away.red { color: #c0392b; }
.shift-away.black { color: #1a1a1a; }
.shift-hidden { background: linear-gradient(145deg, #2b3450, #1c2337); border: 2rpx solid rgba(255,255,255,0.08); }
@keyframes rippleOut {
  0% { transform: scale(0.86); opacity: 0.9; }
  60% { opacity: 0.7; }
  100% { transform: scale(1.18); opacity: 0; }
}
@keyframes shiftBack {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  20% { transform: translateY(-10rpx) scale(1.06); opacity: 1; }
  100% { transform: translate(-46rpx, -190rpx) scale(0.34) rotate(-8deg); opacity: 0; }
}

/* 明投 / 暗投 选择条 */
.shift-bar { display: flex; gap: 16rpx; justify-content: center; }
.shift-act { flex: 1; max-width: 300rpx; display: flex; flex-direction: column; align-items: center; gap: 4rpx; padding: 14rpx 20rpx; border-radius: 16rpx; }
.shift-act.loud { background: rgba(47,185,201,0.16); border: 2rpx solid rgba(47,185,201,0.5); }
.shift-act.mute { background: rgba(123,109,199,0.18); border: 2rpx solid rgba(123,109,199,0.55); }
.act-name { font-size: 26rpx; font-weight: bold; color: #eef2ff; }
.act-desc { font-size: 20rpx; color: #9aa4c0; }
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
