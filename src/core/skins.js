/** 牌面样式（皮肤）定义与本地存储。
 *  皮肤只换外观，不改变规则与配对；纯本地偏好，存 echoarray_skin，不进对局 settings。 */

export const STORAGE_KEY = 'echoarray_skin'

/** 皮肤清单：id 唯一，css 为牌面根节点附加的主题类（skin-{id}） */
export const CARD_SKINS = [
  { id: 'classic', name: '象牙经典', desc: '米白牙面 · 传统配色', css: 'skin-classic' },
  { id: 'night', name: '暗夜墨玉', desc: '墨黑玉面 · 高对比护眼', css: 'skin-night' },
  { id: 'azure', name: '青花瓷韵', desc: '青白瓷面 · 清雅国风', css: 'skin-azure' },
  { id: 'candy', name: '糖果亮色', desc: '明快彩色 · 适老醒目', css: 'skin-candy' },
]

export const DEFAULT_SKIN = 'classic'

/** 读取本地皮肤设置：非法值回退 classic */
export function loadSkin() {
  const v = uni.getStorageSync(STORAGE_KEY)
  return CARD_SKINS.some((s) => s.id === v) ? v : DEFAULT_SKIN
}

/** 持久化皮肤设置 */
export function saveSkin(id) {
  uni.setStorageSync(STORAGE_KEY, id)
}

/** 皮肤 id → 主题 CSS 类（非法回退 classic 的类） */
export function skinClass(id) {
  const s = CARD_SKINS.find((x) => x.id === id)
  return s ? s.css : 'skin-classic'
}
