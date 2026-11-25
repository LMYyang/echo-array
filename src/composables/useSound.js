// 游戏音效单例：实例池（懒创建常驻复用）+ <50ms 防重入节流 + 静音持久化。
// 所有 uni 音频 API 包 try-catch：音频失败静默，绝不影响游戏逻辑。
// bgm 特例：循环播放，独立 start/stopBgm；播报特例：走浏览器 TTS（H5），与操作音互不干扰。
import { ref } from 'vue'

let ctxPool = null
let lastPlayAt = {}
let muted = null // ref，懒初始化（_resetForTest 后重读 storage）
let primed = false // 播报是否已做过一次手势预热
let voiceCache = null

/** 取一个中文 TTS 音色；voices 是异步加载的，取不到时返回 null 交给浏览器默认 */
function pickChineseVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  try {
    if (!voiceCache) {
      const list = window.speechSynthesis.getVoices() || []
      voiceCache = list.find(v => /^zh/i.test(v.lang)) || list.find(v => v.default) || null
    }
    return voiceCache
  } catch {
    return null
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  // 音色列表首次是空的，加载完再缓存一次
  window.speechSynthesis.onvoiceschanged = () => { voiceCache = null }
}

export function _resetForTest() {
  ctxPool = null
  lastPlayAt = {}
  muted = null
  primed = false
  voiceCache = null
}

const NAMES = [
  'click', 'flip', 'match', 'miss', 'replace', 'peek', 'swap', 'turn', 'win', 'lose', 'shuffle',
]

// 操作音 → 静态资源（wav/mp3）
const SFX_FILE = {
  click: 'click.wav',
  flip: 'play_card.mp3',
  match: 'other_play.wav',
  miss: 'turn.wav',
  replace: 'other_play.wav',
  peek: 'click.wav',
  swap: 'other_play.wav',
  turn: 'turn.wav',
  win: 'win.mp3',
  lose: 'lose.wav',
  shuffle: 'shuffle.wav',
}

const BGM_TRACKS = ['50', '32']
const BGM_VOLUME = 0.18

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getCtx(name) {
  if (!ctxPool) ctxPool = {}
  if (!ctxPool[name]) {
    const ctx = uni.createInnerAudioContext()
    if (name.startsWith('bgm_')) {
      ctx.src = `/static/sounds/bgm/${name.slice(4)}.mp3`
      ctx.loop = true
      ctx.volume = BGM_VOLUME
    } else {
      ctx.src = `/static/sounds/${SFX_FILE[name] || 'click.wav'}`
    }
    ctx.onError?.(() => {})
    ctxPool[name] = ctx
  }
  return ctxPool[name]
}

export function useSound() {
  if (muted === null) {
    muted = ref(uni.getStorageSync('echoarray_muted') === true)
  }

  /** 播放操作音；<50ms 同名重复忽略；muted 短路；异常静默 */
  function play(name) {
    if (muted.value || !NAMES.includes(name)) return
    const now = Date.now()
    if (lastPlayAt[name] && now - lastPlayAt[name] < 50) return
    lastPlayAt[name] = now
    try {
      const ctx = getCtx(name)
      ctx.stop?.()
      ctx.play()
    } catch { /* 音频不可用：静默 */ }
  }

  /** 文字播报：H5 走 speechSynthesis；环境不支持或静音时静默。新播报打断旧播报 */
  function announce(text) {
    if (muted.value || !text) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    try {
      const u = new SpeechSynthesisUtterance(String(text))
      u.lang = 'zh-CN'
      u.rate = 1.05
      const voice = pickChineseVoice()
      if (voice) u.voice = voice
      // Chrome 的坑：cancel() 后同一 tick 里 speak() 会被静默丢弃，隔一拍再念
      if (synth.speaking || synth.pending) {
        synth.cancel()
        setTimeout(() => { try { if (synth.paused) synth.resume(); synth.speak(u) } catch { /* 静默 */ } }, 80)
      } else {
        if (synth.paused) synth.resume()
        synth.speak(u)
      }
    } catch { /* 播报不可用：静默 */ }
  }

  /** 首次用户手势时静默「预热」一次，避免部分浏览器把第一次 speak 判为无手势 */
  function primeSpeech() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (primed) return
    primed = true
    try {
      const u = new SpeechSynthesisUtterance('')
      u.volume = 0
      u.lang = 'zh-CN'
      window.speechSynthesis.speak(u)
    } catch { /* 静默 */ }
  }

  /** 起播背景音乐（循环，随机选一首，选定后保持不变） */
  function startBgm() {
    if (muted.value) return
    try {
      const ctx = getCtx(`bgm_${pickRandom(BGM_TRACKS)}`)
      if (ctx.paused === false) return
      ctx.play()
    } catch { /* 音频不可用：静默 */ }
  }

  /** 停止背景音乐。池里没有 bgm 实例（从未起播）时不创建 */
  function stopBgm() {
    if (!ctxPool) return
    for (const k of Object.keys(ctxPool)) {
      if (k.startsWith('bgm_')) {
        try { ctxPool[k].stop?.() } catch { /* 静默 */ }
      }
    }
  }

  /** 切换静音并持久化。开静音停 bgm 与播报；解静音由页面 watch 恢复 */
  function toggleMute() {
    muted.value = !muted.value
    try { uni.setStorageSync('echoarray_muted', muted.value) } catch { /* 存储不可用 */ }
    if (muted.value) {
      stopBgm()
      try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() } catch { /* 静默 */ }
    }
  }

  return { play, announce, primeSpeech, muted, toggleMute, startBgm, stopBgm }
}
