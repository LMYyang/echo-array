// 游戏音效单例：实例池（懒创建常驻复用）+ <50ms 防重入节流 + 静音持久化。
// 所有 uni 音频 API 包 try-catch：音频失败静默，绝不影响游戏逻辑。
// bgm 特例：循环播放，独立 start/stopBgm；播报特例：走浏览器 TTS（H5），与操作音互不干扰。
import { ref } from 'vue'

let ctxPool = null
let lastPlayAt = {}
let muted = null // ref，懒初始化（_resetForTest 后重读 storage）
let primed = false // 播报是否已做过一次手势预热
let voiceCache = null
// 播报队列状态：一次只念一句，念完再念下一句（不 cancel 正在念的句子）
let voiceQueue = []
let speaking = false
let currentText = '' // 正在念的句子，用于同一句连播去重
let retryInfo = null // { text, attempt }：被看门狗重排的句子，带上重试次数，避免无限重试
// 必须一直握着当前这句的引用：Chrome/Edge 会在 utterance 被回收后
// 悄悄掐掉语音，且不再触发 onend（表现就是「播报没声了」）
let liveUtterance = null
let idleTimer = null
let idleSince = 0

const MAX_VOICE_QUEUE = 2

/** 取一个中文 TTS 音色；voices 是异步加载的，取不到时返回 null 交给浏览器默认 */
function pickChineseVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  try {
    if (!voiceCache) {
      const list = window.speechSynthesis.getVoices() || []
      voiceCache = list.find(v => /^zh/i.test(v.lang)) || null
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
  voiceQueue = []
  speaking = false
  currentText = ''
  retryInfo = null
  liveUtterance = null
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  idleSince = 0
}

/** 浏览器 TTS 是否可用 */
function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis
}

/** 清空播报队列并掐断当前播报（静音 / 离开页面时用） */
function stopSpeech() {
  voiceQueue = []
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  idleSince = 0
  speaking = false
  currentText = ''
  retryInfo = null
  liveUtterance = null
  try {
    if (speechAvailable()) {
      window.speechSynthesis.cancel()
      if (window.speechSynthesis.paused) window.speechSynthesis.resume()
    }
  } catch { /* 静默 */ }
}

/**
 * 念一句。引擎迟迟不开口（Chrome/Edge 偶发吞句）时，800ms 后重试一次；
 * onend / onerror 收尾后再念队列里的下一句。
 */
function speakOne(text, attempt) {
  const synth = window.speechSynthesis
  speaking = true
  currentText = text
  let settled = false
  let started = false
  let voice = null
  let hang = null
  try { voice = pickChineseVoice() } catch { voice = null }

  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(guard)
    clearTimeout(hang)
    speaking = false
    currentText = ''
    liveUtterance = null
    setTimeout(pumpSpeech, 140)
  }

  const guard = setTimeout(() => {
    if (settled || started) return // 已经开口了，等它自己念完
    settled = true
    speaking = false
    currentText = ''
    liveUtterance = null
    try { synth.cancel() } catch { /* 静默 */ }
    if (attempt < 2) {
      retryInfo = { text, attempt: attempt + 1 }
      voiceQueue.unshift(text)
    }
    setTimeout(pumpSpeech, 200)
  }, 800)

  // 兜底：个别浏览器会「念完不触发 onend」，卡住整条播报链路
  hang = setTimeout(() => {
    if (settled) return
    if (synth.speaking) { try { synth.cancel() } catch { /* 静默 */ } }
    finish()
  }, Math.max(8000, 2000 + text.length * 400))

  try {
    const u = new SpeechSynthesisUtterance(text)
    liveUtterance = u // 关键：握紧引用，否则 Edge 会中途丢声音且不触发 onend
    u.lang = 'zh-CN'
    u.rate = 1.05
    if (voice) u.voice = voice
    u.onstart = () => { started = true }
    u.onend = finish
    u.onerror = finish
    if (synth.paused) synth.resume()
    synth.speak(u)
  } catch { finish() }
}

/** 队列泵：引擎空闲才开口；被别人占着就等，等太久（卡死）才强推一次 */
function pumpSpeech() {
  if (speaking || !voiceQueue.length || !speechAvailable()) return
  if (muted && muted.value) return
  const synth = window.speechSynthesis
  if (synth.speaking || synth.pending) {
    if (!idleSince) idleSince = Date.now()
    if (Date.now() - idleSince > 1600) {
      // 引擎卡在 speaking 状态不动了：清一次，避免整个播报链路哑掉
      try { synth.cancel() } catch { /* 静默 */ }
      try { if (synth.paused) synth.resume() } catch { /* 静默 */ }
      idleSince = Date.now()
    }
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => { idleTimer = null; pumpSpeech() }, 100)
    return
  }
  idleSince = 0
  const next = voiceQueue.shift()
  const att = retryInfo && retryInfo.text === next ? retryInfo.attempt : 1
  retryInfo = null
  speakOne(next, att)
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

  /**
   * 文字播报：H5 走 speechSynthesis；环境不支持或静音时静默。
   * 进队列排队念（最多积压 2 句），不再 cancel 正在念的句子——
   * 旧实现「cancel + 80ms 后 speak」在 Chrome / Edge 上会互相打断甚至整条链路哑掉。
   */
  function announce(text) {
    if (muted.value || !text) return
    if (!speechAvailable()) return
    const line = String(text)
    // 同一句去重：正在念的、队列尾部的都不再重复入队
    if (line === currentText || voiceQueue[voiceQueue.length - 1] === line) return
    if (voiceQueue.length >= MAX_VOICE_QUEUE) voiceQueue.shift()
    voiceQueue.push(line)
    pumpSpeech()
  }

  /**
   * 首次用户手势时静默「预热」一次，避免部分浏览器把第一次 speak 判为无手势。
   * 用全角空格而不是空串：空串会被部分引擎直接忽略，起不到解锁作用。
   */
  function primeSpeech() {
    if (!speechAvailable() || primed) return
    primed = true
    try {
      const synth = window.speechSynthesis
      const u = new SpeechSynthesisUtterance('　')
      liveUtterance = u
      u.volume = 0
      u.lang = 'zh-CN'
      u.onend = () => { setTimeout(pumpSpeech, 120) }
      u.onerror = () => { setTimeout(pumpSpeech, 120) }
      if (synth.paused) synth.resume()
      synth.speak(u)
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
      stopSpeech()
    }
  }

  return { play, announce, primeSpeech, muted, toggleMute, startBgm, stopBgm, stopSpeech }
}
