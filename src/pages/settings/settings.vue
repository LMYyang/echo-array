<template>
  <view class="settings">
    <text class="title">游戏设置</text>

    <view class="card">
      <view class="row">
        <view class="row-main">
          <text class="row-title">对局人数</text>
          <text class="row-sub">真人 1 名，其余由 AI 补足</text>
        </view>
        <view class="options">
          <text v-for="n in [2, 3, 4]" :key="n" class="opt" :class="{ on: draft.playerCount === n, disabled: readonly }" @click="pickCount(n)">{{ n }} 人</text>
        </view>
      </view>

      <view class="row">
        <view class="row-main">
          <text class="row-title">AI 难度</text>
          <text class="row-sub">记忆准确率与干扰频率随难度提升</text>
        </view>
        <view class="options">
          <text v-for="d in DIFFS" :key="d.key" class="opt" :class="{ on: draft.difficulty === d.key, disabled: readonly }" @click="pickDiff(d.key)">{{ d.label }}</text>
        </view>
      </view>

      <view class="row">
        <view class="row-main">
          <text class="row-title">干扰上限</text>
          <text class="row-sub">每人每局普通替换干扰次数（1–5）</text>
        </view>
        <view class="stepper">
          <text class="step-btn" :class="{ disabled: readonly }" @click="stepLimit(-1)">−</text>
          <text class="step-val">{{ draft.interferenceLimit }}</text>
          <text class="step-btn" :class="{ disabled: readonly }" @click="stepLimit(1)">＋</text>
        </view>
      </view>

      <view class="row">
        <view class="row-main">
          <text class="row-title">静音</text>
          <text class="row-sub">关闭全部音效与播报</text>
        </view>
        <view class="switch" :class="{ on: draft.muted }" @click="toggleMute">
          <view class="knob" />
        </view>
      </view>
    </view>

    <!-- 牌面样式：纯本地偏好 -->
    <view class="card skin-card">
      <view class="skin-header">
        <text class="row-title">牌面样式</text>
        <text class="row-sub">只改变自己看到的牌面，其他玩家不受影响</text>
      </view>
      <view class="skin-grid">
        <view v-for="s in CARD_SKINS" :key="s.id" class="skin-item" :class="{ active: skin === s.id }" @click="pickSkin(s.id)">
          <view class="skin-preview" :class="s.css">
            <view class="pv-face red">A</view>
            <view class="pv-face black">K</view>
          </view>
          <text class="skin-name">{{ s.name }}</text>
          <text class="skin-desc">{{ s.desc }}</text>
        </view>
      </view>
    </view>

    <view class="actions">
      <button v-if="isNet && !readonly" class="btn-primary" @click="save">保存</button>
      <button class="btn-secondary" @click="back">返回</button>
    </view>
    <text v-if="readonly" class="readonly-hint">对局设置由房主修改</text>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { normalizeSettings } from '../../core/settings.js'
import { CARD_SKINS, loadSkin, saveSkin } from '../../core/skins.js'
import { sharedNet } from '../../utils/net.js'

const DIFFS = [
  { key: 'easy', label: '简单' },
  { key: 'normal', label: '普通' },
  { key: 'hard', label: '困难' },
]

const isNet = ref(false)
const readonly = ref(false)
const draft = reactive({ ...normalizeSettings(uni.getStorageSync('echoarray_settings')) })
const skin = ref(loadSkin())

onLoad((query) => {
  isNet.value = query?.mode === 'net'
  if (isNet.value) {
    readonly.value = query.host !== '1'
    if (query.s) {
      try { Object.assign(draft, normalizeSettings(JSON.parse(decodeURIComponent(query.s)))) } catch { /* 忽略坏参 */ }
    }
  }
})

function persistSolo() {
  if (!isNet.value) {
    uni.setStorageSync('echoarray_settings', { ...draft })
    uni.setStorageSync('echoarray_muted', draft.muted)
  }
}

function pickCount(n) { if (readonly.value) return; draft.playerCount = n; persistSolo() }
function pickDiff(key) { if (readonly.value) return; draft.difficulty = key; persistSolo() }
function stepLimit(d) {
  if (readonly.value) return
  draft.interferenceLimit = Math.min(5, Math.max(1, draft.interferenceLimit + d))
  persistSolo()
}
function toggleMute() {
  draft.muted = !draft.muted
  persistSolo()
}
function pickSkin(id) { skin.value = id; saveSkin(id) }

async function save() {
  try {
    const net = sharedNet()
    const res = await net.request('room.setSettings', { settings: { ...draft } })
    if (res.type === 'error') {
      uni.showToast({ title: res.payload?.message || '保存失败', icon: 'none' })
      return
    }
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
    return
  }
  uni.showToast({ title: '已保存', icon: 'none' })
  back()
}

function back() { uni.navigateBack() }
</script>

<style scoped>
.settings { min-height: 100vh; padding: 80rpx 40rpx 60rpx; box-sizing: border-box; display: flex; flex-direction: column; gap: 32rpx; }
.title { font-size: 48rpx; font-weight: bold; color: #eef2ff; text-align: center; }
.card { background: rgba(255, 255, 255, 0.05); border: 2rpx solid rgba(255, 255, 255, 0.08); border-radius: 20rpx; padding: 8rpx 24rpx; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 26rpx 8rpx; border-bottom: 1rpx solid rgba(255,255,255,0.08); }
.row:last-child { border-bottom: none; }
.row-main { display: flex; flex-direction: column; gap: 6rpx; flex: 1; }
.row-title { font-size: 30rpx; color: #eef2ff; }
.row-sub { font-size: 22rpx; color: #9aa4c0; line-height: 1.4; }
.options { display: flex; gap: 12rpx; }
.opt { padding: 10rpx 22rpx; border-radius: 12rpx; font-size: 24rpx; color: #9aa4c0; background: rgba(255,255,255,0.05); border: 2rpx solid rgba(255,255,255,0.08); }
.opt.on { color: #0b1c22; background: #2fb9c9; border-color: #2fb9c9; font-weight: bold; }
.opt.disabled { opacity: 0.45; }
.stepper { display: flex; align-items: center; gap: 20rpx; }
.step-btn { width: 48rpx; height: 48rpx; border-radius: 12rpx; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 30rpx; color: #eef2ff; }
.step-btn.disabled { opacity: 0.45; }
.step-val { font-size: 30rpx; font-weight: bold; width: 48rpx; text-align: center; }
.switch { width: 84rpx; height: 44rpx; border-radius: 999rpx; background: #2a3550; border: 2rpx solid rgba(255,255,255,0.1); position: relative; transition: background 0.2s; flex: none; }
.switch.on { background: #2fb9c9; border-color: #2fb9c9; }
.switch .knob { position: absolute; top: 2rpx; left: 2rpx; width: 36rpx; height: 36rpx; border-radius: 50%; background: #eef2ff; transition: left 0.2s; }
.switch.on .knob { left: 42rpx; }
.actions { display: flex; gap: 20rpx; margin-top: 16rpx; }
.actions .btn-primary, .actions .btn-secondary { flex: 1; }
.readonly-hint { text-align: center; font-size: 22rpx; color: #9aa4c0; }

.skin-card { gap: 16rpx; padding: 24rpx; }
.skin-header { display: flex; flex-direction: column; gap: 6rpx; }
.skin-grid { display: flex; flex-wrap: wrap; gap: 20rpx; }
.skin-item { flex: 1 1 calc(50% - 10rpx); min-width: 280rpx; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 6rpx; padding: 20rpx 12rpx; border-radius: 14rpx; background: rgba(0,0,0,0.18); border: 2rpx solid rgba(255,255,255,0.08); }
.skin-item.active { border-color: #2fb9c9; background: rgba(47,185,201,0.12); }
.skin-preview { display: flex; gap: 12rpx; }
.pv-face { width: 44rpx; height: 60rpx; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 26rpx; font-weight: 700; background: linear-gradient(145deg,#f5f1e6,#ddd5c0); }
.pv-face.red { color: #c0392b; }
.pv-face.black { color: #1a1a1a; }
.skin-night .pv-face { background: linear-gradient(145deg,#2b2b33,#16161c); }
.skin-night .pv-face.red { color: #e35d4f; }
.skin-night .pv-face.black { color: #e8e4da; }
.skin-azure .pv-face { background: linear-gradient(145deg,#eef4f6,#cfe0e6); }
.skin-candy .pv-face { background: linear-gradient(145deg,#fffdf2,#ffe9b8); }
.skin-name { font-size: 26rpx; color: #eef2ff; font-weight: bold; }
.skin-item.active .skin-name { color: #2fb9c9; }
.skin-desc { font-size: 20rpx; color: #9aa4c0; }
</style>
