// 仪表盘纯计算函数。无副作用、不碰网络，便于单测。

export interface PracticeRow { sentenceId: string; isCorrect: boolean; createdAt?: string }
export interface ReviewRow { reps: number; nextReviewAt: string }
export interface BlankRow { word: string; isCorrect: boolean }

/** 本地自然日 key：YYYY-MM-DD（按运行环境本地时区） */
export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 连续打卡天：从今天（今天没练则从昨天）往前数连续有练习的自然日数。 */
export function computeStreak(rows: PracticeRow[], now: Date): number {
  const days = new Set<string>()
  for (const r of rows) if (r.createdAt) days.add(localDayKey(new Date(r.createdAt)))
  if (days.size === 0) return 0
  const cursor = new Date(now)
  if (!days.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(localDayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface DayStat { day: string; total: number; correct: number; rate: number }

/** 近 days 天每天正确率（按句计），从早到晚。 */
export function dailyAccuracy(rows: PracticeRow[], days: number, now: Date): DayStat[] {
  const totals = new Map<string, { total: number; correct: number }>()
  for (const r of rows) {
    if (!r.createdAt) continue
    const k = localDayKey(new Date(r.createdAt))
    const t = totals.get(k) ?? { total: 0, correct: 0 }
    t.total++
    if (r.isCorrect) t.correct++
    totals.set(k, t)
  }
  const out: DayStat[] = []
  const cursor = new Date(now)
  cursor.setDate(cursor.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const k = localDayKey(cursor)
    const t = totals.get(k) ?? { total: 0, correct: 0 }
    out.push({ day: k, total: t.total, correct: t.correct, rate: t.total ? t.correct / t.total : 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export interface HeatCell { day: string; count: number; level: 0 | 1 | 2 | 3 | 4 }

/** 近 weeks*7 天活跃热力图，从早到晚。 */
export function activityHeatmap(rows: PracticeRow[], weeks: number, now: Date): HeatCell[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.createdAt) continue
    const k = localDayKey(new Date(r.createdAt))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const total = weeks * 7
  const out: HeatCell[] = []
  const cursor = new Date(now)
  cursor.setDate(cursor.getDate() - (total - 1))
  for (let i = 0; i < total; i++) {
    const k = localDayKey(cursor)
    const c = counts.get(k) ?? 0
    const level: HeatCell['level'] = c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 9 ? 3 : 4
    out.push({ day: k, count: c, level })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export interface Bucket { bucket: string; count: number }

/** 掌握度分布：按 SM-2 reps 分桶。 */
export function masteryDistribution(reviews: ReviewRow[]): Bucket[] {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0
  for (const r of reviews) {
    if (r.reps <= 0) b0++
    else if (r.reps === 1) b1++
    else if (r.reps === 2) b2++
    else b3++
  }
  return [
    { bucket: '新学', count: b0 },
    { bucket: '1 次', count: b1 },
    { bucket: '2 次', count: b2 },
    { bucket: '3+ 次', count: b3 },
  ]
}

/** 今日待复习：nextReviewAt 早于明日 0 点（与错题本口径一致）。 */
export function dueCount(reviews: ReviewRow[], now: Date): number {
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const tomorrow = todayStart.getTime() + 86400000
  return reviews.filter(r => new Date(r.nextReviewAt).getTime() < tomorrow).length
}

/** 已掌握：reps >= 2。 */
export function masteredCount(reviews: ReviewRow[]): number {
  return reviews.filter(r => r.reps >= 2).length
}

/** 累计练习句（去重 sentenceId）。 */
export function practicedSentenceCount(rows: PracticeRow[]): number {
  return new Set(rows.map(r => r.sentenceId)).size
}

export interface ErrorWord { word: string; misses: number; total: number }

/** 词级最易错榜：按答错次数降序，仅含错过的词。 */
export function topErrorWords(attempts: BlankRow[], limit: number): ErrorWord[] {
  const agg = new Map<string, { misses: number; total: number }>()
  for (const a of attempts) {
    const t = agg.get(a.word) ?? { misses: 0, total: 0 }
    t.total++
    if (!a.isCorrect) t.misses++
    agg.set(a.word, t)
  }
  return [...agg.entries()]
    .map(([word, t]) => ({ word, misses: t.misses, total: t.total }))
    .filter(w => w.misses > 0)
    .sort((a, b) => b.misses - a.misses || b.total - a.total)
    .slice(0, limit)
}
