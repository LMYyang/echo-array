<template>
  <view class="seat" :class="{ active, isMe }">
    <view class="seat-head">
      <text class="seat-label">{{ label }}</text>
      <text v-if="active" class="active-dot">● 行动中</text>
    </view>
    <view class="seat-stats">
      <text>手牌 {{ handCount }}</text>
      <text>收集 {{ collectedCount }}</text>
      <text v-if="interferenceLimit > 0">干扰 {{ interferenceUsed }}/{{ interferenceLimit }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  handCount: { type: Number, default: 0 },
  collectedCount: { type: Number, default: 0 },
  interferenceUsed: { type: Number, default: 0 },
  interferenceLimit: { type: Number, default: 3 },
  active: { type: Boolean, default: false },
  isMe: { type: Boolean, default: false },
})
</script>

<style scoped>
.seat {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 14rpx 20rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  min-width: 200rpx;
}
.seat.active { border-color: #2fb9c9; background: rgba(47, 185, 201, 0.1); }
.seat-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.seat-label { font-size: 26rpx; font-weight: 700; color: #eef2ff; }
.active-dot { font-size: 20rpx; color: #2fb9c9; }
.seat-stats { display: flex; gap: 16rpx; font-size: 22rpx; color: #9aa4c0; }
</style>
