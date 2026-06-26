import { useEffect, useMemo, useState } from 'react'
import { Flame, Target, AlarmClock, BookCheck, ChevronRight, LineChart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { parseContent, normalizeAnswer } from '@/lib/annotation'
import { fetchSentences } from '../services/sentenceService'
import { fetchPracticeRows, fetchReviewRows, fetchBlankRows } from '../services/statsService'
import {
  computeStreak, dailyAccuracy, activityHeatmap, masteryDistribution,
  dueCount, masteredCount, practicedSentenceCount, topErrorWords,
  type PracticeRow, type ReviewRow, type BlankRow,
} from '@/lib/stats'
import type { DBSentence } from '../types/index'

interface Props {
  onPractice: (sentences: DBSentence[], title: string) => void
}

// 热力图 5 档（靛蓝渐深）+ 掌握度 4 档（按熟练度由浅到深）
const HEAT_BG = ['bg-muted', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary']
const DIST_BG = ['bg-primary/25', 'bg-primary/45', 'bg-primary/65', 'bg-primary']

export default function StatsPage({ onPractice }: Props) {
  const [loading, setLoading] = useState(true)
  const [practice, setPractice] = useState<PracticeRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [blanks, setBlanks] = useState<BlankRow[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchPracticeRows(), fetchReviewRows(), fetchBlankRows()])
      .then(([p, r, b]) => { setPractice(p); setReviews(r); setBlanks(b) })
      .finally(() => setLoading(false))
  }, [])

  const now = useMemo(() => new Date(), [])
  const streak = useMemo(() => computeStreak(practice, now), [practice, now])
  const due = useMemo(() => dueCount(reviews, now), [reviews, now])
  const mastered = useMemo(() => masteredCount(reviews), [reviews])
  const practiced = useMemo(() => practicedSentenceCount(practice), [practice])
  const trend = useMemo(() => dailyAccuracy(practice, 14, now), [practice, now])
  const heat = useMemo(() => activityHeatmap(practice, 6, now), [practice, now])
  const dist = useMemo(() => masteryDistribution(reviews), [reviews])
  const errors = useMemo(() => topErrorWords(blanks, 8), [blanks])

  // 点易错词 → 取所有含该词的句子开练
  const practiceWord = async (word: string) => {
    const all = await fetchSentences()
    const matched = all.filter(s =>
      parseContent(s.content).some(seg => seg.type === 'blank' && normalizeAnswer(seg.answer) === word)
    )
    if (matched.length === 0) return
    onPractice(matched, `攻克生词 · ${word}`)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  // 整页空状态：新用户尚无任何记录
  if (practice.length === 0 && reviews.length === 0 && blanks.length === 0) {
    return (
      <Card className="anim-rise">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <LineChart className="size-7" />
          </span>
          <h3 className="text-base font-semibold">还没有学习数据</h3>
          <p className="max-w-[34ch] text-sm text-muted-foreground">
            切换到上方「练习」标签，完成第一组练习后，
            这里会出现你的正确率曲线、掌握度分布和易错词榜。
          </p>
        </CardContent>
      </Card>
    )
  }

  // —— 趋势折线（仅连接有练习的天，避免休息日被画成 0%）——
  const W = 100, H = 40, PAD = 4
  const active = trend.map((d, i) => ({ ...d, i })).filter(d => d.total > 0)
  const hasTrend = active.length > 0
  const xy = active.map(d => ({
    x: trend.length > 1 ? (d.i / (trend.length - 1)) * W : W / 2,
    y: PAD + (1 - d.rate) * (H - PAD * 2),
    rate: d.rate,
  }))
  const linePts = xy.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const baseY = (H - PAD).toFixed(1)
  const areaPath = hasTrend
    ? `M ${xy[0].x.toFixed(1)},${baseY} L ${linePts.split(' ').join(' L ')} L ${xy[xy.length - 1].x.toFixed(1)},${baseY} Z`
    : ''
  const last = hasTrend ? xy[xy.length - 1] : null
  const avgRate = hasTrend ? active.reduce((s, d) => s + d.rate, 0) / active.length : 0
  const midY = PAD + 0.5 * (H - PAD * 2)

  // —— 掌握度分布 ——
  const maxDist = Math.max(1, ...dist.map(d => d.count))

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi delay={0} icon={<BookCheck className="size-4" />} label="累计练习句" value={practiced} />
        <Kpi delay={60} icon={<Target className="size-4" />} label="已掌握" value={mastered} />
        <Kpi delay={120} icon={<AlarmClock className="size-4" />} label="今日待复习" value={due} tone={due > 0 ? 'pending' : 'default'} />
        <Kpi delay={180} icon={<Flame className="size-4" />} label="连续打卡天" value={streak} tone={streak > 0 ? 'accent' : 'default'} />
      </div>

      {/* 趋势 + 掌握度分布 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="anim-rise" style={{ animationDelay: '240ms' }}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">正确率趋势 · 近 14 天</h3>
              {hasTrend && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums text-primary">{Math.round(last!.rate * 100)}%</span>
                  <span className="text-[0.7rem] text-muted-foreground">均 {Math.round(avgRate * 100)}%</span>
                </div>
              )}
            </div>
            {hasTrend ? (
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full text-primary">
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* 50% 参考线 */}
                <line x1="0" y1={midY} x2={W} y2={midY} stroke="currentColor" strokeOpacity="0.15"
                  strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                <path d={areaPath} fill="url(#trendFill)" />
                <polyline points={linePts} fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {last && (
                  <circle cx={last.x} cy={last.y} r="3" fill="currentColor"
                    stroke="var(--card)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                )}
              </svg>
            ) : (
              <p className="grid h-28 place-items-center text-sm text-muted-foreground">近 14 天还没有练习记录</p>
            )}
          </CardContent>
        </Card>

        <Card className="anim-rise" style={{ animationDelay: '300ms' }}>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">掌握度分布</h3>
            <div className="flex h-28 items-end gap-3">
              {dist.map((d, i) => (
                <div key={d.bucket} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs font-semibold tabular-nums">{d.count}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className={`w-full rounded-t-md transition-all ${DIST_BG[i]}`}
                      style={{ height: `${Math.max(4, (d.count / maxDist) * 100)}%` }} />
                  </div>
                  <span className="text-[0.7rem] text-muted-foreground">{d.bucket}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 热力图 */}
      <Card className="anim-rise" style={{ animationDelay: '360ms' }}>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">最近 6 周活跃</h3>
            <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
              <span>少</span>
              {HEAT_BG.map((bg, i) => <span key={i} className={`size-2.5 rounded-sm ${bg}`} />)}
              <span>多</span>
            </div>
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: '1fr' }}>
            {heat.map(c => (
              <div key={c.day} title={`${c.day}：${c.count} 次`}
                className={`aspect-square rounded-sm ${HEAT_BG[c.level]}`} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 词级最易错榜 */}
      <Card className="anim-rise" style={{ animationDelay: '420ms' }}>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">最易错生词 · 点击攻克</h3>
          {errors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              还没有错词数据，去练几题就会出现（仅统计新练习的记录）。
            </p>
          ) : (
            <ul className="space-y-1.5">
              {errors.map((e, i) => (
                <li key={e.word}>
                  <button
                    onClick={() => practiceWord(e.word)}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-muted text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{e.word}</span>
                    <Badge variant="destructive" className="tabular-nums">错 {e.misses}</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">/ {e.total}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type Tone = 'default' | 'pending' | 'accent'
const TONE_TEXT: Record<Tone, string> = {
  default: 'text-foreground',
  pending: 'text-amber-600',   // 待办召唤：琥珀色（非错误红）
  accent: 'text-primary',
}

function Kpi({ icon, label, value, tone = 'default', delay = 0 }: {
  icon: React.ReactNode; label: string; value: number; tone?: Tone; delay?: number
}) {
  return (
    <Card className="anim-rise transition-shadow hover:shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`mt-2 text-2xl font-bold tabular-nums ${TONE_TEXT[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
