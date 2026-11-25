<template>
  <view
    class="array-card"
    :class="[skinCls, { empty: !cell, faceDown: cell && !cell.faceUp, selected, target, disabled }]"
    @click="$emit('tap', cell ? cell.slot : -1)"
  >
    <template v-if="!cell">
      <view class="empty-slot" />
    </template>
    <template v-else-if="!cell.faceUp">
      <view class="card-back" />
    </template>
    <template v-else>
      <view class="card-face" :class="cell.card.color">
        <text class="rank">{{ cell.card.label }}</text>
        <text class="suit">{{ cell.card.suitLabel }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { loadSkin, skinClass } from '../core/skins.js'

defineProps({
  cell: { type: Object, default: null }, // { slot, faceUp, card } | null
  selected: { type: Boolean, default: false },
  target: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['tap'])

const skinCls = computed(() => skinClass(loadSkin()))
</script>

<style scoped>
.array-card {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 14rpx;
  box-sizing: border-box;
  transition: transform 0.15s, box-shadow 0.15s;
}
.array-card.selected { transform: translateY(-8rpx); }
.array-card.target { box-shadow: 0 0 0 4rpx #2fb9c9; }
.array-card.disabled { opacity: 0.5; }

.empty-slot {
  width: 100%;
  height: 100%;
  border: 2rpx dashed rgba(255, 255, 255, 0.16);
  border-radius: 14rpx;
  box-sizing: border-box;
}

.card-back {
  width: 100%;
  height: 100%;
  border-radius: 14rpx;
  background: linear-gradient(145deg, #233258, #141d36);
  border: 2rpx solid rgba(47, 185, 201, 0.35);
  box-shadow: inset 0 0 0 6rpx rgba(47, 185, 201, 0.08);
}

.card-face {
  width: 100%;
  height: 100%;
  border-radius: 14rpx;
  background: linear-gradient(145deg, #f5f1e6, #ddd5c0);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.4);
}
.card-face.red { color: #c0392b; }
.card-face.black { color: #1a1a1a; }
.rank { font-size: 34rpx; font-weight: 700; line-height: 1; }
.suit { font-size: 24rpx; line-height: 1; }

/* 皮肤：night 墨黑 */
.skin-night .card-face { background: linear-gradient(145deg, #2b2b33, #16161c); }
.skin-night .card-face.red { color: #e35d4f; }
.skin-night .card-face.black { color: #e8e4da; }
/* 皮肤：azure 青花 */
.skin-azure .card-face { background: linear-gradient(145deg, #eef4f6, #cfe0e6); }
/* 皮肤：candy 亮色 */
.skin-candy .card-face { background: linear-gradient(145deg, #fffdf2, #ffe9b8); }
</style>
