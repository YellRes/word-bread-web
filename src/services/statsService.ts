import { supabase } from '../utils/supabase'
import type { PracticeRow, ReviewRow, BlankRow } from '../lib/stats'

export const fetchPracticeRows = async (): Promise<PracticeRow[]> => {
  const { data, error } = await supabase.from('PracticeRecord').select('sentenceId, isCorrect, createdAt')
  if (error) { console.error('Error fetching practice rows:', error); return [] }
  return (data ?? []).map((r: any) => ({
    sentenceId: r.sentenceId?.toString() ?? '',
    isCorrect: !!r.isCorrect,
    createdAt: r.createdAt,
  }))
}

export const fetchReviewRows = async (): Promise<ReviewRow[]> => {
  const { data, error } = await supabase.from('ReviewState').select('reps, nextReviewAt')
  if (error) { console.error('Error fetching review rows:', error); return [] }
  return (data ?? []).map((r: any) => ({ reps: r.reps ?? 0, nextReviewAt: r.nextReviewAt }))
}

export const fetchBlankRows = async (): Promise<BlankRow[]> => {
  const { data, error } = await supabase.from('BlankAttempt').select('word, isCorrect')
  if (error) { console.error('Error fetching blank rows:', error); return [] }
  return (data ?? []).map((r: any) => ({ word: r.word ?? '', isCorrect: !!r.isCorrect }))
}
