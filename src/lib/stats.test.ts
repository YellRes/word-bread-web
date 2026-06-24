import { describe, it, expect } from 'vitest'
import {
  computeStreak, dailyAccuracy, activityHeatmap, masteryDistribution,
  dueCount, masteredCount, practicedSentenceCount, topErrorWords, localDayKey,
} from './stats'

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0).toISOString()

describe('computeStreak', () => {
  it('今天有练 → 连续含今天', () => {
    const now = new Date(2026, 0, 5, 12)
    const rows = [{ sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 5) },
                  { sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 4) }]
    expect(computeStreak(rows, now)).toBe(2)
  })
  it('今天没练但昨天有 → 从昨天起算', () => {
    const now = new Date(2026, 0, 5, 12)
    const rows = [{ sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 4) },
                  { sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 3) }]
    expect(computeStreak(rows, now)).toBe(2)
  })
  it('中间断档 → 只数到断点', () => {
    const now = new Date(2026, 0, 5, 12)
    const rows = [{ sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 5) },
                  { sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 3) }]
    expect(computeStreak(rows, now)).toBe(1)
  })
  it('无记录 → 0', () => {
    expect(computeStreak([], new Date(2026, 0, 5))).toBe(0)
  })
})

describe('dailyAccuracy', () => {
  it('返回固定天数、正确率正确', () => {
    const now = new Date(2026, 0, 3, 12)
    const rows = [
      { sentenceId: 'a', isCorrect: true, createdAt: iso(2026, 1, 3) },
      { sentenceId: 'b', isCorrect: false, createdAt: iso(2026, 1, 3) },
    ]
    const r = dailyAccuracy(rows, 3, now)
    expect(r).toHaveLength(3)
    expect(r[2].day).toBe(localDayKey(now))
    expect(r[2].total).toBe(2)
    expect(r[2].rate).toBe(0.5)
    expect(r[0].total).toBe(0)
  })
})

describe('activityHeatmap', () => {
  it('分档：0/1-2/3-5/6-9/10+', () => {
    const now = new Date(2026, 0, 1, 12)
    const mk = (n: number) => Array.from({ length: n }, () => ({ sentenceId: 's', isCorrect: true, createdAt: iso(2026, 1, 1) }))
    expect(activityHeatmap(mk(1), 1, now).slice(-1)[0].level).toBe(1)
    expect(activityHeatmap(mk(4), 1, now).slice(-1)[0].level).toBe(2)
    expect(activityHeatmap(mk(7), 1, now).slice(-1)[0].level).toBe(3)
    expect(activityHeatmap(mk(12), 1, now).slice(-1)[0].level).toBe(4)
    expect(activityHeatmap([], 1, now)).toHaveLength(7)
  })
})

describe('masteryDistribution / masteredCount / dueCount', () => {
  const reviews = [
    { reps: 0, nextReviewAt: iso(2026, 1, 1) },
    { reps: 1, nextReviewAt: iso(2026, 1, 1) },
    { reps: 2, nextReviewAt: iso(2030, 1, 1) },
    { reps: 5, nextReviewAt: iso(2030, 1, 1) },
  ]
  it('分桶计数', () => {
    expect(masteryDistribution(reviews).map(b => b.count)).toEqual([1, 1, 1, 1])
  })
  it('已掌握 reps>=2', () => {
    expect(masteredCount(reviews)).toBe(2)
  })
  it('今日待复习 = 到期数', () => {
    expect(dueCount(reviews, new Date(2026, 0, 5))).toBe(2)
  })
})

describe('practicedSentenceCount', () => {
  it('按 sentenceId 去重', () => {
    const rows = [
      { sentenceId: 'a', isCorrect: true }, { sentenceId: 'a', isCorrect: false }, { sentenceId: 'b', isCorrect: true },
    ]
    expect(practicedSentenceCount(rows)).toBe(2)
  })
})

describe('topErrorWords', () => {
  it('按错次降序、过滤没错过的、限量', () => {
    const a = [
      { word: 'probe', isCorrect: false }, { word: 'probe', isCorrect: false },
      { word: 'surplus', isCorrect: false }, { word: 'easy', isCorrect: true },
    ]
    const r = topErrorWords(a, 10)
    expect(r.map(w => w.word)).toEqual(['probe', 'surplus'])
    expect(r[0].misses).toBe(2)
  })
})
