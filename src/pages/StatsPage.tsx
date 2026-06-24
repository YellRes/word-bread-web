import { useEffect, useMemo, useState } from 'react'
import { Flame, Target, AlarmClock, BookCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

const HEAT_BG = ['bg-primary/10', 'bg-primary/30', 'bg-primary/50', 'bg-primary/75', 'bg-primary']

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
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  const maxDist = Math.max(1, ...dist.map(d => d.count))
  const w = 100, h = 36
  const points = trend.map((d, i) => {
    const x = trend.length > 1 ? (i / (trend.length - 1)) * w : 0
    const y = h - d.rate * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<BookCheck className="size-4" />} label="累计练习句" value={practiced} />
        <Kpi icon={<Target className="size-4" />} label="已掌握" value={mastered} />
        <Kpi icon={<AlarmClock className="size-4" />} label="今日待复习" value={due} accent={due > 0} />
        <Kpi icon={<Flame className="size-4" />} label="连续打卡天" value={streak} />
      </div>

      {/* 趋势 + 掌握度分布 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">正确率趋势（近 14 天）</h3>
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-24 w-full">
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5"
              className="text-primary" vectorEffect="non-scaling-stroke" />
          </svg>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">掌握度分布</h3>
          <div className="flex h-24 items-end gap-3">
            {dist.map(d => (
              <div key={d.bucket} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t bg-primary/70"
                    style={{ height: `${(d.count / maxDist) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums">{d.count}</span>
                <span className="text-[0.7rem] text-muted-foreground">{d.bucket}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      {/* 热力图 */}
      <Card><CardContent className="p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">最近 6 周活跃</h3>
        <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: '1fr' }}>
          {heat.map(c => (
            <div key={c.day} title={`${c.day}：${c.count} 次`}
              className={`aspect-square rounded-sm ${HEAT_BG[c.level]}`} />
          ))}
        </div>
      </CardContent></Card>

      {/* 词级最易错榜 */}
      <Card><CardContent className="p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">最易错生词（点击攻克）</h3>
        {errors.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            还没有错词数据，去练几题就会出现（仅统计新练习的记录）。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {errors.map(e => (
              <li key={e.word}>
                <button
                  onClick={() => practiceWord(e.word)}
                  className="flex w-full items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{e.word}</span>
                  <span className="text-destructive">错 {e.misses} 次 / 共 {e.total}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  )
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
    </CardContent></Card>
  )
}
