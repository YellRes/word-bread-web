import { supabase } from '../utils/supabase'
import type { DBSentence, SentenceFormData } from '../types/index'

export const fetchSentences = async (params: {
  content?: string
  articleId?: string
} = {}): Promise<DBSentence[]> => {
  let query = supabase
    .from('Sentence')
    .select('*')
    .order('createdAt', { ascending: false })

  if (params.articleId) {
    query = query.eq('articleId', params.articleId)
  }
  if (params.content) {
    query = query.ilike('content', `%${params.content}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching sentences:', error)
    return []
  }

  return (data || []).map((s: any) => ({
    id: s.id.toString(),
    content: s.content,
    articleId: s.articleId?.toString() || '',
    translate: s.translate || '',
    userId: s.userId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))
}

export const createSentence = async (data: SentenceFormData): Promise<boolean> => {
  const { error } = await supabase.from('Sentence').insert({
    id: crypto.randomUUID(),
    content: data.content,
    articleId: data.articleId,
    translate: data.translate,
  })

  if (error) {
    console.error('Error creating sentence:', error)
    return false
  }
  return true
}

export const updateSentence = async (
  id: string,
  data: Partial<SentenceFormData>
): Promise<boolean> => {
  const { error } = await supabase
    .from('Sentence')
    .update(data)
    .eq('id', id)

  if (error) {
    console.error('Error updating sentence:', error)
    return false
  }
  return true
}

export const deleteSentence = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('Sentence').delete().eq('id', id)

  if (error) {
    console.error('Error deleting sentence:', error)
    return false
  }
  return true
}

export const batchCreateSentences = async (rows: SentenceFormData[]): Promise<{ count: number; error?: string }> => {
  const { error, count } = await supabase.from('Sentence').insert(
    rows.map(r => ({ id: crypto.randomUUID(), ...r }))
  )

  if (error) {
    console.error('Error batch creating sentences:', error)
    return { count: 0, error: error.message }
  }
  return { count: rows.length }
}
