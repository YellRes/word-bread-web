import { describe, it, expect } from 'vitest'
import { gradeFrom, sm2, nextReviewIso, INITIAL_SM2 } from './sm2'

describe('gradeFrom', () => {
  it('显示答案记为 1', () => {
    expect(gradeFrom({ revealed: true, correctBlanks: 2, totalBlanks: 2 })).toBe(1)
  })
  it('全对记为 5', () => {
    expect(gradeFrom({ revealed: false, correctBlanks: 2, totalBlanks: 2 })).toBe(5)
  })
  it('对一半以上(>=0.6)记为 3', () => {
    expect(gradeFrom({ revealed: false, correctBlanks: 3, totalBlanks: 5 })).toBe(3)
  })
  it('对得少(<0.6)记为 2', () => {
    expect(gradeFrom({ revealed: false, correctBlanks: 1, totalBlanks: 5 })).toBe(2)
  })
})

describe('sm2', () => {
  it('首次答对：reps0 -> 间隔 1 天', () => {
    const s = sm2(INITIAL_SM2, 5)
    expect(s.reps).toBe(1)
    expect(s.intervalDays).toBe(1)
  })
  it('第二次答对：reps1 -> 间隔 6 天', () => {
    const s = sm2({ reps: 1, intervalDays: 1, ease: 2.5, lapses: 0 }, 5)
    expect(s.intervalDays).toBe(6)
  })
  it('第三次答对：间隔 = round(interval×旧ease)（间隔用更新前的 ease）', () => {
    const s = sm2({ reps: 2, intervalDays: 6, ease: 2.5, lapses: 0 }, 5)
    expect(s.intervalDays).toBe(15) // round(6 * 2.5)
  })
  it('答错：reps 归零、间隔回到 1、lapses+1', () => {
    const s = sm2({ reps: 3, intervalDays: 30, ease: 2.5, lapses: 0 }, 2)
    expect(s.reps).toBe(0)
    expect(s.intervalDays).toBe(1)
    expect(s.lapses).toBe(1)
  })
  it('ease 下限 1.3', () => {
    let s = { reps: 0, intervalDays: 0, ease: 1.3, lapses: 0 }
    s = sm2(s, 0)
    expect(s.ease).toBeGreaterThanOrEqual(1.3)
  })
})

describe('nextReviewIso', () => {
  it('在 base 上加 intervalDays 天', () => {
    const base = new Date('2026-01-01T00:00:00.000Z')
    const iso = nextReviewIso(6, base)
    expect(new Date(iso).getTime()).toBe(base.getTime() + 6 * 86400000)
  })
})
