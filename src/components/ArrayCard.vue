<template>
  <view
    class="array-card"
    :class="[skinCls, { empty: !cell, faceDown: cell && !cell.faceUp, selected, target, disabled, refill }]"
    @click="$emit('tap', cell ? cell.slot : -1)"
  >
    <!-- 空位：凹陷底色 + 极淡虚线 + 低对比「空位」字样 -->
    <view v-if="!cell" class="empty-slot">
      <text class="empty-label">空位</text>
    </view>

    <!-- 背面：始终存在，翻开时向中线压扁淡出，形成翻面过程 -->
    <view v-if="cell" class="card-back" :class="{ 'back-out': cell.faceUp }">
      <view class="back-pattern" />
      <view class="back-emblem">
        <view class="back-ring" />
        <view class="back-rhombus" />
      </view>
    </view>

    <!-- 正面：从压扁状态展开，盖回时反向收合 -->
    <view
      v-if="cell"
      class="card-face"
      :class="[cell.card ? cell.card.color : '', { 'face-in': cell.faceUp }]"
    >
      <text v-if="cell.card" class="rank">{{ cell.card.label }}</text>
      <text v-if="cell.card" class="suit">{{ cell.card.suitLabel }}</text>
    </view>
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
  refill: { type: Boolean, default: false }, // 刚补进阵面：播放入场动画
})
defineEmits(['tap'])

const skinCls = computed(() => skinClass(loadSkin()))
</script>

<style scoped>
.array-card {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 14rpx;
  box-sizing: border-box;
  transition: transform 0.15s, box-shadow 0.15s;
}
.array-card.selected { transform: translateY(-8rpx); }
.array-card.target { box-shadow: 0 0 0 4rpx #2fb9c9; }
.array-card.disabled { opacity: 0.5; }

/* 补牌入场：新补进阵面的牌自上而下落位并短暂提亮 */
.array-card.refill { animation: cardFillIn 0.46s cubic-bezier(0.22, 0.9, 0.3, 1) both; }
@keyframes cardFillIn {
  0% { transform: translateY(-16%) scale(0.88); opacity: 0; }
  55% { transform: translateY(0) scale(1.03); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

/* 空位：比牌更暗、凹陷、虚线，中间一个几乎融进桌面的「空位」字样，一眼可与背面牌区分 */
.empty-slot {
  width: 100%;
  height: 100%;
  border: 2rpx dashed rgba(255, 255, 255, 0.08);
  border-radius: 14rpx;
  box-sizing: border-box;
  background: rgba(8, 12, 22, 0.30);
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-label {
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: rgba(154, 164, 192, 0.22);
}

/* 翻牌 / 盖牌：背面与正面都在原位，靠横向压扁 + 淡入淡出完成「翻」的过程 */
.card-back,
.card-face {
  position: absolute;
  inset: 0;
}

/* 背面牌：真实卡牌感的牌背——细密斜纹 + 中心纹章（圆环 + 菱形） */
.card-back {
  border-radius: 14rpx;
  overflow: hidden;
  background: linear-gradient(155deg, #24334f 0%, #1a2440 55%, #131c31 100%);
  border: 2rpx solid rgba(47, 185, 201, 0.42);
  box-shadow: inset 0 0 0 5rpx rgba(47, 185, 201, 0.10), 0 4rpx 10rpx rgba(0, 0, 0, 0.38);
  transform: scaleX(1);
  opacity: 1;
  transition: transform 0.34s cubic-bezier(0.4, 0.1, 0.2, 1), opacity 0.14s linear 0.16s;
}
.card-back.back-out {
  transform: scaleX(0.06);
  opacity: 0;
}
.back-pattern {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(126, 196, 224, 0.09) 0 2rpx, transparent 2rpx 14rpx),
    repeating-linear-gradient(-45deg, rgba(126, 196, 224, 0.09) 0 2rpx, transparent 2rpx 14rpx),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.03) 0 2rpx, transparent 2rpx 12rpx);
}
.back-emblem {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-ring {
  position: absolute;
  width: 46%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3rpx solid rgba(126, 196, 224, 0.26);
  box-shadow: inset 0 0 0 3rpx rgba(126, 196, 224, 0.12), 0 0 12rpx rgba(47, 185, 201, 0.10);
  background: radial-gradient(circle, rgba(47, 185, 201, 0.10) 0 52%, transparent 53%);
}
.back-rhombus {
  width: 22%;
  aspect-ratio: 1;
  transform: rotate(45deg);
  background: rgba(126, 196, 224, 0.16);
  border: 2rpx solid rgba(126, 196, 224, 0.30);
}

/* 正面牌 */
.card-face {
  border-radius: 14rpx;
  background: linear-gradient(145deg, #f5f1e6, #ddd5c0);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.4);
  transform: scaleX(0.06);
  opacity: 0;
  transition: transform 0.30s cubic-bezier(0.4, 0.1, 0.2, 1) 0.16s, opacity 0.14s linear 0.16s;
}
.card-face.face-in {
  transform: scaleX(1);
  opacity: 1;
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
