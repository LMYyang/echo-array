import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/** 极简 speechSynthesis 替身：记录被念的句子，手动触发 onend */
function makeSynth() {
  return {
    speaking: false,
    pending: false,
    paused: false,
    cancelCount: 0,
    spoken: [],
    current: null,
    speak(u) {
      this.spoken.push(u)
      this.current = u
      this.speaking = true
    },
    cancel() { this.cancelCount += 1; this.speaking = false; this.current = null },
    resume() {},
    getVoices() { return [{ lang: 'zh-CN', name: 'fake-zh' }] },
    endCurrent() {
      const u = this.current
      this.speaking = false
      this.current = null
      u?.onend?.()
    },
  }
}

let synth

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  synth = makeSynth()
  globalThis.window = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: class {
      constructor(text) { this.text = text }
    },
  }
  globalThis.SpeechSynthesisUtterance = globalThis.window.SpeechSynthesisUtterance
  globalThis.uni = {
    getStorageSync: () => false,
    setStorageSync: () => {},
    createInnerAudioContext: () => ({
      src: '', paused: true, play() {}, stop() {}, onError() {},
    }),
  }
})

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.window
  delete globalThis.uni
})

async function freshSound() {
  const mod = await import('../src/composables/useSound.js')
  mod._resetForTest()
  return mod.useSound()
}

describe('播报队列', () => {
  it('播报途中来新播报：不打断当前句，排队等念完', async () => {
    const sound = await freshSound()
    sound.announce('第一句')
    expect(synth.spoken.map((u) => u.text)).toEqual(['第一句'])

    sound.announce('第二句')
    sound.announce('第三句')
    expect(synth.cancelCount).toBe(0)
    expect(synth.spoken).toHaveLength(1) // 还在念第一句

    synth.endCurrent()
    await vi.advanceTimersByTimeAsync(200)
    expect(synth.spoken.map((u) => u.text)).toEqual(['第一句', '第二句'])
  })

  it('引擎迟迟没开口时自动重试一次，不会整条链路哑掉', async () => {
    const sound = await freshSound()
    sound.announce('重试句')
    // speak 了但 onstart 没来：800ms 后重试，重试要先把卡住的引擎清掉
    await vi.advanceTimersByTimeAsync(4000)
    expect(synth.spoken.map((u) => u.text)).toEqual(['重试句', '重试句'])
  })

  it('静音时不播报', async () => {
    const sound = await freshSound()
    sound.toggleMute()
    sound.announce('静音中')
    expect(synth.spoken).toHaveLength(0)
  })

  it('重复句去重', async () => {
    const sound = await freshSound()
    sound.announce('同一句')
    sound.announce('同一句')
    synth.endCurrent()
    await vi.advanceTimersByTimeAsync(200)
    expect(synth.spoken.map((u) => u.text)).toEqual(['同一句'])
  })
})
