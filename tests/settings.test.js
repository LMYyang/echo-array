import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/core/settings.js'

describe('normalizeSettings 设置规整', () => {
  it('空输入回退默认值', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('合法值原样保留', () => {
    const s = normalizeSettings({ playerCount: 3, difficulty: 'hard', interferenceLimit: 5, muted: true })
    expect(s).toEqual({ playerCount: 3, difficulty: 'hard', interferenceLimit: 5, muted: true })
  })

  it('人数越界回退默认', () => {
    expect(normalizeSettings({ playerCount: 5 }).playerCount).toBe(4)
    expect(normalizeSettings({ playerCount: 1 }).playerCount).toBe(4)
  })

  it('难度枚举白名单', () => {
    expect(normalizeSettings({ difficulty: 'impossible' }).difficulty).toBe('normal')
  })

  it('干扰上限 clamp 1–5', () => {
    expect(normalizeSettings({ interferenceLimit: 99 }).interferenceLimit).toBe(5)
    expect(normalizeSettings({ interferenceLimit: 0 }).interferenceLimit).toBe(1)
    expect(normalizeSettings({ interferenceLimit: 'x' }).interferenceLimit).toBe(3)
  })

  it('剥离多余字段', () => {
    const s = normalizeSettings({ foo: 1, playerCount: 2 })
    expect(s).not.toHaveProperty('foo')
  })
})
