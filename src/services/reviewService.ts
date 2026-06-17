import { supabase } from '../utils/supabase'
import { hasBlanks } from '../lib/annotation'
import { INITIAL_SM2, gradeFrom, sm2, nextReviewIso, type Sm2State } from '../lib/sm2'
import { fetchArticles } from './articleService'
import type { DBSentence, ReviewItem, ReviewState } from '../types/index'

const normalizeSentence = (s: Record<string, any>): DBSentence => ({
  id: s.id.toString(),
  content: s.content,
  articleId: s.articleId?.toString() || '',
  translate: s.translate || '',
  userId: s.userId,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
})

export interface ReviewResultInput {
  sentenceId: string
  articleId: string
  revealed: boolean
  correctBlanks: number
  totalBlanks: number
}

/**
 * 练习后更新某句的 SM-2 复习状态。
 * 进池规则：首次练习且本次答对（q>=3）不建行（不算错题）；否则建/更新。
 */
export const upsertReview = async (input: ReviewResultInput): Promise<boolean> => {
  const q = gradeFrom(input)

  const { data: existing, error: readErr } = await supabase
    .from('ReviewState')
    .select('*')
    .eq('sentenceId', input.sentenceId)
    .maybeSingle()

  if (readErr) {
    console.error('Error reading ReviewState:', readErr)
    return false
  }

  if (!existing && q >= 3) return true // 首次就答对，不进复习池

  const prev: Sm2State = existing
    ? {
        reps: existing.reps,
        intervalDays: existing.intervalDays,
        ease: existing.ease,
        lapses: existing.lapses,
      }
    : INITIAL_SM2

  const next = sm2(prev, q)
  const now = new Date()

  const row = {
    sentenceId: input.sentenceId,
    articleId: input.articleId,
    reps: next.reps,
    intervalDays: next.intervalDays,
    ease: next.ease,
    lapses: next.lapses,
    lastGrade: q,
    lastReviewAt: now.toISOString(),
    nextReviewAt: nextReviewIso(next.intervalDays, now),
    updatedAt: now.toISOString(),
  }

  const { error } = await supabase.from('ReviewState').upsert(row, { onConflict: 'sentenceId' })
  if (error) {
    console.error('Error upserting ReviewState:', error)
    return false
  }
  return true
}

/** 拉所有复习项，关联句子/文章，标记是否到期，按 nextReviewAt 升序（到期在前）。 */
export const fetchReviewItems = async (): Promise<ReviewItem[]> => {
  const { data, error } = await supabase.from('ReviewState').select('*')
  if (error || !data || data.length === 0) {
    if (error) console.error('Error fetching ReviewState:', error)
    return []
  }
  const states = data as ReviewState[]
  const ids = states.map(s => s.sentenceId.toString())

  const { data: sData, error: sErr } = await supabase.from('Sentence').select('*').in('id', ids)
  if (sErr || !sData) {
    if (sErr) console.error('Error fetching review sentences:', sErr)
    return []
  }
  const sentenceById = new Map(sData.map((s: any) => [s.id.toString(), normalizeSentence(s)]))

  const articles = await fetchArticles()
  const titleById = new Map(articles.map(a => [a.id, a.title]))

  // 按「自然日」判定到期：安排在今天或更早的都算今日待复习（与 formatDue 口径一致）
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = todayStart.getTime() + 86400000
  return states
    .map((st): ReviewItem | null => {
      const sentence = sentenceById.get(st.sentenceId.toString())
      if (!sentence || !hasBlanks(sentence.content)) return null // 句子被删/改得没标注词
      return {
        sentence,
        articleTitle: titleById.get(sentence.articleId) ?? '未知文章',
        state: st,
        due: new Date(st.nextReviewAt).getTime() < tomorrowStart,
      }
    })
    .filter((x): x is ReviewItem => x !== null)
    .sort((a, b) => new Date(a.state.nextReviewAt).getTime() - new Date(b.state.nextReviewAt).getTime())
}

/**
 * 历史回填：把「曾经答错、但还没有 ReviewState 行」的句子，
 * 按 PracticeRecord 历史回放 SM-2 补一行。幂等（已存在的不覆盖）。
 */
export const backfillReviewStates = async (): Promise<void> => {
  const { data: recs, error } = await supabase
    .from('PracticeRecord')
    .select('sentenceId, articleId, revealed, correctBlanks, totalBlanks, createdAt')
    .order('createdAt', { ascending: true })
  if (error || !recs || recs.length === 0) {
    if (error) console.error('Error reading PracticeRecord for backfill:', error)
    return
  }

  const { data: existing } = await supabase.from('ReviewState').select('sentenceId')
  const have = new Set((existing ?? []).map((r: any) => r.sentenceId.toString()))

  type Rec = { articleId: string; revealed: boolean; correctBlanks: number; totalBlanks: number; createdAt?: string }
  const byId = new Map<string, Rec[]>()
  for (const r of recs as any[]) {
    const sid = r.sentenceId?.toString()
    if (!sid || have.has(sid)) continue
    if (!byId.has(sid)) byId.set(sid, [])
    byId.get(sid)!.push({
      articleId: r.articleId?.toString() || '',
      revealed: !!r.revealed,
      correctBlanks: r.correctBlanks ?? 0,
      totalBlanks: r.totalBlanks ?? 0,
      createdAt: r.createdAt,
    })
  }

  const rows: any[] = []
  for (const [sid, list] of byId) {
    let state: Sm2State | null = null
    let lastAt: string | undefined
    let lastGrade = 0
    let articleId = ''
    for (const r of list) {
      const q = gradeFrom(r)
      if (state === null && q >= 3) continue // 进池前的全对不入池
      state = sm2(state ?? INITIAL_SM2, q)
      lastAt = r.createdAt
      lastGrade = q
      articleId = r.articleId || articleId
    }
    if (!state) continue // 从没错过 → 不入池
    const base = lastAt ? new Date(lastAt) : new Date()
    rows.push({
      sentenceId: sid,
      articleId,
      reps: state.reps,
      intervalDays: state.intervalDays,
      ease: state.ease,
      lapses: state.lapses,
      lastGrade,
      lastReviewAt: base.toISOString(),
      nextReviewAt: nextReviewIso(state.intervalDays, base),
      updatedAt: new Date().toISOString(),
    })
  }

  if (rows.length === 0) return
  const { error: insErr } = await supabase
    .from('ReviewState')
    .upsert(rows, { onConflict: 'sentenceId', ignoreDuplicates: true })
  if (insErr) console.error('Error backfilling ReviewState:', insErr)
}
