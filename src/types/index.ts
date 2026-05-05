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
