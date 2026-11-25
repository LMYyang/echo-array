<template>
  <view class="menu">
    <view class="logo-area">
      <view class="logo-grid">
        <view v-for="n in 6" :key="n" class="logo-cell" :class="{ on: n === 2 || n === 5 }" />
      </view>
      <text class="title">回声阵</text>
      <text class="subtitle">翻牌记忆 × 手牌干扰 · 2–4 人卡牌博弈</text>
    </view>

    <view class="menu-buttons">
      <button class="btn-primary" @click="startGame">开始游戏（单机）</button>
      <button class="btn-secondary" @click="startOnline">联网对战</button>
      <button class="btn-secondary" @click="openSettings">游戏设置</button>
      <button class="btn-secondary" @click="rulesOpen = true">玩法说明</button>

      <!-- 战绩卡：单机 | 联网，点击进历史 -->
      <view class="stats-card">
        <view class="stats-block" @click="openHistory('solo')">
          <text class="stats-label">单机</text>
          <text class="stats-val">{{ soloStats.rounds }} 局</text>
          <text class="stats-sub">胜率 {{ winRate(soloStats) }} ›</text>
        </view>
        <view class="stats-divider" />
        <view class="stats-block" @click="openHistory('net')">
          <text class="stats-label net">联网</text>
          <text class="stats-val net">{{ netStats.rounds }} 局</text>
          <text class="stats-sub">胜率 {{ winRate(netStats) }} ›</text>
        </view>
      </view>

      <!-- 近期收集走势（最近 10 局，条形图） -->
      <view class="chart-card">
        <text class="chart-title">近 10 局收集张数</text>
        <view v-if="trend.length === 0" class="chart-empty">还没有对局记录</view>
        <view v-else class="chart-bars">
          <view v-for="(v, i) in trend" :key="i" class="bar-col">
            <view class="bar" :style="{ height: barHeight(v) }" />
            <text class="bar-val">{{ v }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 历史记录弹层 -->
    <view v-if="historyOpen" class="overlay" @click="historyOpen = false">
      <view class="history-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ historyMode === 'net' ? '联网对局记录' : '单机对局记录' }}</text>
          <text class="modal-close" @click="historyOpen = false">✕</text>
        </view>
        <view class="history-list">
          <view v-if="modeHistory.length === 0" class="history-empty">还没有对局记录</view>
          <view v-for="(h, i) in modeHistory" :key="h.time" class="history-item" @click="toggleExpand(i)">
            <view class="item-head">
              <text class="item-time">{{ formatTime(h.time) }}</text>
              <text class="item-tag">{{ h.playerCount }} 人 · {{ DIFF[h.difficulty] || h.difficulty || '普通' }}</text>
              <text class="item-my" :class="{ win: (h.winners || []).includes(h.mySeat ?? 0) }">{{ h.myCollected }} 张</text>
            </view>
            <view v-if="expandedIdx === i" class="item-detail">
              <view v-for="r in h.ranks" :key="r.seat" class="detail-row" :class="{ me: r.seat === (h.mySeat ?? 0), winner: (h.winners || []).includes(r.seat) }">
                <text class="d-name">{{ labelOf(h, r.seat) }}</text>
                <text class="d-meta">{{ r.collectedCount }} 张 · {{ r.pairs }} 对</text>
                <text class="d-score">{{ r.score }} 分</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 玩法说明弹层 -->
    <view v-if="rulesOpen" class="overlay" @click="rulesOpen = false">
      <view class="rules-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">玩法说明</text>
          <text class="modal-close" @click="rulesOpen = false">✕</text>
        </view>
        <scroll-view class="rules-body" scroll-y>
          <text class="rule-h">阵面与开局</text>
          <text class="rule-p">54 张牌洗牌后，12 张背面朝上排成 3×4 回声阵；每人发 4 张手牌，其余为抽牌堆。</text>
          <text class="rule-h">回合三选一</text>
          <text class="rule-p">1. 翻牌配对：翻开两张背面牌，点数相同则收走，不同则盖回。</text>
          <text class="rule-p">2. 手牌干扰：打出一张普通手牌，替换阵中已翻开的牌；被换出的牌背面放进空位，破坏他人记忆。每人每局限 {{ limit }} 次。</text>
          <text class="rule-p">3. 王牌行动：小王暗中窥视一张背面牌；大王不看原牌直接强换一张牌。</text>
          <text class="rule-h">补给与结束</text>
          <text class="rule-p">回合末手牌补至 4 张，阵面空位分批补牌；阵空且抽牌堆耗尽后结算，收集牌张最多者胜。</text>
          <text class="rule-h">提示</text>
          <text class="rule-p">被替换或盖回的位置，旧记忆会失效；记住公开亮过的牌，在对手之前凑成对子。</text>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { loadStats, loadHistory, netSummary, recentCollected } from '../../composables/history.js'
import { normalizeSettings } from '../../core/settings.js'

const DIFF = { easy: '简单', normal: '普通', hard: '困难' }
const SEAT_LABELS = ['我', '下家', '对家', '上家']

const statsRaw = ref(loadStats())
const historyRaw = ref(loadHistory())
const soloStats = computed(() => statsRaw.value)
const netStats = computed(() => netSummary(historyRaw.value))
const trend = computed(() => recentCollected(historyRaw.value, 10))

const rulesOpen = ref(false)
const historyOpen = ref(false)
const historyMode = ref('solo')
const expandedIdx = ref(-1)

const modeHistory = computed(() =>
  historyRaw.value.filter((h) => (historyMode.value === 'net' ? h.mode === 'net' : h.mode !== 'net'))
)

function winRate(s) {
  if (!s.rounds) return '—'
  return `${Math.round((s.wins / s.rounds) * 100)}%`
}
function barHeight(v) {
  const max = Math.max(...trend.value, 1)
  return `${Math.max(12, Math.round((v / max) * 90))}rpx`
}

function openHistory(mode) {
  historyMode.value = mode
  expandedIdx.value = -1
  historyOpen.value = true
}
function toggleExpand(i) { expandedIdx.value = expandedIdx.value === i ? -1 : i }

function labelOf(h, seat) {
  if (h.mode === 'net') return (h.names && h.names[seat]) || `座位${seat}`
  return SEAT_LABELS[seat] || `座位${seat}`
}
function formatTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const settings = computed(() => normalizeSettings(uni.getStorageSync('echoarray_settings')))
const limit = computed(() => settings.value.interferenceLimit)

onShow(() => {
  statsRaw.value = loadStats()
  historyRaw.value = loadHistory()
})

function startGame() { uni.navigateTo({ url: '/pages/game/game' }) }
function startOnline() { uni.navigateTo({ url: '/pages/lobby/lobby' }) }
function openSettings() { uni.navigateTo({ url: '/pages/settings/settings' }) }
</script>

<style scoped>
.menu { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 100rpx 60rpx 60rpx; box-sizing: border-box; gap: 48rpx; }
.logo-area { display: flex; flex-direction: column; align-items: center; gap: 20rpx; }
.logo-grid { display: grid; grid-template-columns: repeat(3, 26rpx); gap: 10rpx; margin-bottom: 12rpx; }
.logo-cell { width: 26rpx; height: 34rpx; border-radius: 6rpx; border: 2rpx solid rgba(47,185,201,0.5); }
.logo-cell.on { background: #2fb9c9; }
.title { font-size: 72rpx; font-weight: bold; letter-spacing: 10rpx; color: #eef2ff; }
.subtitle { font-size: 26rpx; color: #9aa4c0; }
.menu-buttons { display: flex; flex-direction: column; gap: 28rpx; width: 100%; align-items: center; }
.stats-card { display: flex; align-items: stretch; gap: 32rpx; padding: 24rpx 40rpx; border-radius: 16rpx; background: rgba(255,255,255,0.05); border: 2rpx solid rgba(255,255,255,0.08); }
.stats-block { display: flex; flex-direction: column; align-items: center; gap: 8rpx; min-width: 160rpx; }
.stats-divider { width: 2rpx; background: rgba(255,255,255,0.1); }
.stats-label { font-size: 22rpx; color: #9aa4c0; }
.stats-label.net { color: #2fb9c9; }
.stats-val { font-size: 36rpx; font-weight: bold; color: #2fb9c9; }
.stats-val.net { color: #5fd6e3; }
.stats-sub { font-size: 20rpx; color: #9aa4c0; }

.chart-card { width: 100%; max-width: 560rpx; padding: 24rpx; border-radius: 16rpx; background: rgba(255,255,255,0.04); border: 2rpx solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 16rpx; }
.chart-title { font-size: 24rpx; color: #9aa4c0; }
.chart-empty { font-size: 22rpx; color: #7a86a6; text-align: center; padding: 20rpx 0; }
.chart-bars { display: flex; align-items: flex-end; gap: 12rpx; height: 120rpx; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6rpx; height: 100%; justify-content: flex-end; }
.bar { width: 100%; max-width: 36rpx; background: linear-gradient(180deg, #2fb9c9, #1f7f8c); border-radius: 6rpx 6rpx 0 0; }
.bar-val { font-size: 18rpx; color: #9aa4c0; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 99; }
.rules-modal, .history-modal { background: #1a2338; border: 2rpx solid rgba(47,185,201,0.3); border-radius: 24rpx; padding: 32rpx 28rpx; width: 640rpx; max-height: 78vh; box-sizing: border-box; display: flex; flex-direction: column; gap: 16rpx; }
.modal-header { display: flex; justify-content: space-between; align-items: center; }
.modal-title { font-size: 32rpx; font-weight: bold; color: #eef2ff; }
.modal-close { font-size: 32rpx; color: #9aa4c0; padding: 8rpx 20rpx; }
.rules-body { max-height: 56vh; }
.rule-h { display: block; font-size: 28rpx; font-weight: bold; color: #2fb9c9; margin: 16rpx 0 8rpx; }
.rule-p { display: block; font-size: 24rpx; color: #c6cde4; line-height: 1.7; margin-bottom: 8rpx; }

.history-list { display: flex; flex-direction: column; gap: 12rpx; overflow-y: auto; }
.history-empty { text-align: center; color: #9aa4c0; font-size: 24rpx; padding: 24rpx 0; }
.history-item { padding: 16rpx 24rpx; border-radius: 12rpx; background: rgba(255,255,255,0.04); border: 2rpx solid rgba(255,255,255,0.06); }
.item-head { display: flex; align-items: center; gap: 16rpx; }
.item-time { font-size: 24rpx; color: #9aa4c0; flex: 1; }
.item-tag { font-size: 20rpx; color: #7a86a6; }
.item-my { font-size: 26rpx; font-weight: bold; color: #c6cde4; }
.item-my.win { color: #2fb9c9; }
.item-detail { margin-top: 12rpx; display: flex; flex-direction: column; gap: 8rpx; }
.detail-row { display: flex; align-items: center; gap: 12rpx; padding: 6rpx 8rpx; border-radius: 8rpx; }
.detail-row.me { background: rgba(47,185,201,0.12); }
.detail-row.winner .d-name { color: #2fb9c9; font-weight: bold; }
.d-name { font-size: 24rpx; color: #eef2ff; width: 120rpx; }
.d-meta { font-size: 22rpx; color: #9aa4c0; flex: 1; }
.d-score { font-size: 24rpx; font-weight: bold; color: #c6cde4; }
</style>
