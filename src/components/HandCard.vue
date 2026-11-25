<template>
  <view
    class="hand-card"
    :class="[skinCls, { selected, joker: card.joker, disabled }]"
    @click="$emit('tap', card)"
  >
    <view class="face" :class="card.color">
      <text class="rank">{{ card.label }}</text>
      <text class="suit">{{ card.suitLabel }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { loadSkin, skinClass } from '../core/skins.js'

defineProps({
  card: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['tap'])

const skinCls = computed(() => skinClass(loadSkin()))
</script>

<style scoped>
.hand-card {
  width: 84rpx;
  height: 116rpx;
  border-radius: 12rpx;
  transition: transform 0.15s;
}
.hand-card.selected { transform: translateY(-12rpx); }
.hand-card.disabled { opacity: 0.5; }
.face {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
  background: linear-gradient(145deg, #f5f1e6, #ddd5c0);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.4);
}
.face.red { color: #c0392b; }
.face.black { color: #1a1a1a; }
.joker .face { background: linear-gradient(145deg, #2b2b33, #16161c); }
.joker.face.red, .joker .face.red { color: #e35d4f; }
.joker .face.black { color: #e8e4da; }
/* 皮肤：night 墨黑 */
.skin-night .face { background: linear-gradient(145deg, #2b2b33, #16161c); }
.skin-night .face.red { color: #e35d4f; }
.skin-night .face.black { color: #e8e4da; }
/* 皮肤：azure 青花 */
.skin-azure .face { background: linear-gradient(145deg, #eef4f6, #cfe0e6); }
/* 皮肤：candy 亮色 */
.skin-candy .face { background: linear-gradient(145deg, #fffdf2, #ffe9b8); }
.rank { font-size: 26rpx; font-weight: 700; line-height: 1; }
.suit { font-size: 20rpx; line-height: 1; }
</style>
