// 新手教学引导：分步高亮 + 可跳过；完成后持久化不再弹出。
import { ref } from 'vue'

const DONE_KEY = 'echoarray_guide_done'

const STEPS = [
  { zone: 'array', title: '翻牌配对', text: '点击阵中背面牌翻开两张，点数相同即可收入收集堆；不同则盖回原位。' },
  { zone: 'hand', title: '手牌干扰', text: '点一张普通手牌进入改写模式：先点阵中任意一格作目标（正面牌更值得改写），再选明投（牌面朝上、全场可见）或暗投（牌面朝下、只有你知道）；被挤出的原牌会退回牌堆底。' },
  { zone: 'hand', title: '王牌行动', text: '小王可暗中窥视一张背面牌（只有你自己看到）；大王不看原牌，直接强换任意一张。' },
  { zone: 'top', title: '补给与结算', text: '回合末手牌补至 4 张、阵面分批补牌；阵空且抽牌堆耗尽后结算，收集牌张最多者获胜。' },
]

export function useGuide() {
  const done = ref(readDone())
  const step = ref(0)

  function readDone() {
    try { return uni.getStorageSync(DONE_KEY) === true } catch { return false }
  }

  const active = ref(!done.value)
  const current = () => STEPS[step.value]

  function next() {
    if (step.value < STEPS.length - 1) {
      step.value += 1
    } else {
      finish()
    }
  }

  function skip() { finish() }

  function finish() {
    active.value = false
    done.value = true
    try { uni.setStorageSync(DONE_KEY, true) } catch { /* 存储不可用 */ }
  }

  return { active, step, steps: STEPS, current, next, skip, finish }
}
