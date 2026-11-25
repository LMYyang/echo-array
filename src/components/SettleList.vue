<template>
  <view class="settle-list">
    <view
      v-for="r in result.ranks"
      :key="r.seat"
      class="settle-row"
      :class="{ winner: result.winners.includes(r.seat) }"
    >
      <text class="rank-no">{{ r.rank }}</text>
      <text class="who">{{ labelOf(r.seat) }}</text>
      <text class="meta">{{ r.collectedCount }} 张 · {{ r.pairs }} 对</text>
      <text class="score" :class="{ neg: r.score < 0 }">{{ r.score > 0 ? '+' : '' }}{{ r.score }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  result: { type: Object, required: true },
  labelOf: { type: Function, required: true },
})
</script>

<style scoped>
.settle-list { display: flex; flex-direction: column; gap: 12rpx; width: 100%; }
.settle-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.05);
}
.settle-row.winner { background: rgba(47, 185, 201, 0.14); border: 2rpx solid #2fb9c9; }
.rank-no { font-size: 28rpx; font-weight: 700; color: #2fb9c9; width: 40rpx; }
.who { font-size: 28rpx; color: #eef2ff; flex: 1; }
.meta { font-size: 22rpx; color: #9aa4c0; }
.score { font-size: 28rpx; font-weight: 700; width: 80rpx; text-align: right; color: #eef2ff; }
.score.neg { color: #e35d4f; }
</style>
