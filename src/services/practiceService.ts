import { supabase } from '../utils/supabase'

export interface PracticeRecordInput {
  sentenceId: string
  articleId: string
  isCorrect: boolean
  totalBlanks: number
  correctBlanks: number
  revealed: boolean
}

/** 写入一条练习记录。失败返回 false（调用方仅提示，不阻断练习）。 */
export const recordPractice = async (input: PracticeRecordInput): Promise<boolean> => {
  const { error } = await supabase
    .from('PracticeRecord')
    .insert({ id: crypto.randomUUID(), ...input })

  if (error) {
    console.error('Error recording practice:', error)
    return false
  }
  return true
}

/** 查某文章的历史正确率（句级）。 */
export const fetchArticleAccuracy = async (
  articleId: string
): Promise<{ total: number; correct: number; rate: number }> => {
  const { data, error } = await supabase
    .from('PracticeRecord')
    .select('isCorrect')
    .eq('articleId', articleId)

  if (error || !data) {
    if (error) console.error('Error fetching accuracy:', error)
    return { total: 0, correct: 0, rate: 0 }
  }
  const total = data.length
  const correct = data.filter((r: { isCorrect: boolean }) => r.isCorrect).length
  return { total, correct, rate: total ? correct / total : 0 }
}
