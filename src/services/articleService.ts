import { supabase } from '../utils/supabase'
import type { DBArticle } from '../types/index'

export const createArticle = async (title: string): Promise<boolean> => {
  const { error } = await supabase.from('Article').insert({
    id: crypto.randomUUID(),
    title,
  })
  if (error) {
    console.error('Error creating article:', error)
    return false
  }
  return true
}

export const deleteArticle = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('Article').delete().eq('id', id)
  if (error) {
    console.error('Error deleting article:', error)
    return false
  }
  return true
}

export const fetchArticles = async (): Promise<DBArticle[]> => {
  const { data, error } = await supabase
    .from('Article')
    .select('*')
    .order('createdAt', { ascending: false })

  if (error) {
    console.error('Error fetching articles:', error)
    return []
  }

  return (data || []).map((a: any) => ({
    id: a.id.toString(),
    title: a.title,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }))
}
