export interface DBArticle {
  id: string
  title: string
  createdAt?: string
  updatedAt?: string
}

export interface DBSentence {
  id: string
  content: string
  articleId: string
  translate: string
  userId?: string
  createdAt?: string
  updatedAt?: string
}

export interface SentenceFormData {
  content: string
  articleId: string
  translate: string
}

export interface PracticeRecord {
  id: string
  sentenceId: string
  articleId: string
  isCorrect: boolean
  totalBlanks: number
  correctBlanks: number
  revealed: boolean
  userId?: string
  createdAt?: string
}

/** SM-2 间隔重复状态（每句一行，对应 Supabase ReviewState 表） */
export interface ReviewState {
  sentenceId: string
  articleId: string
  reps: number
  intervalDays: number
  ease: number
  lapses: number
  lastGrade?: number
  lastReviewAt?: string
  nextReviewAt: string
  userId?: string
  updatedAt?: string
}

/** 错题本一行：复习状态 + 句子内容 + 是否到期 */
export interface ReviewItem {
  sentence: DBSentence
  articleTitle: string
  state: ReviewState
  /** nextReviewAt <= now */
  due: boolean
}
