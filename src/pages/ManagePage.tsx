import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Upload, ChevronRight, ChevronDown, ListChecks, Pencil, Trash2, FilePlus2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatMonth } from '@/lib/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import SentenceModal from '../components/SentenceModal'
import BatchUploadModal from '../components/BatchUploadModal'
import { createArticle, deleteArticle, fetchArticles } from '../services/articleService'
import {
  batchCreateSentences,
  createSentence,
  deleteSentence,
  fetchSentences,
  updateSentence,
} from '../services/sentenceService'
import type { DBArticle, DBSentence, SentenceFormData } from '../types/index'

function renderContent(text: string) {
  // 把 (单词) 渲染成品牌琥珀高亮，其余原样
  const parts = text.split(/(\([^)]+\))/g)
  return (
    <span>
      {parts.map((part, i) =>
        /^\([^)]+\)$/.test(part) ? (
          <span
            key={i}
            className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.92em] font-semibold text-primary"
          >
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

// 按「创建月份」把文章归组，保留传入顺序（fetchArticles 已按 createdAt 降序，故最新月在前）
function groupByMonth(articles: DBArticle[]): { label: string; items: DBArticle[] }[] {
  const groups: { label: string; items: DBArticle[] }[] = []
  const index = new Map<string, number>()
  for (const a of articles) {
    const label = formatMonth(a.createdAt)
    let i = index.get(label)
    if (i === undefined) {
      i = groups.length
      index.set(label, i)
      groups.push({ label, items: [] })
    }
    groups[i].items.push(a)
  }
  return groups
}

interface Props {
  onPractice: (articleId: string) => void
}

export default function ManagePage({ onPractice }: Props) {
  const [articles, setArticles] = useState<DBArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [sentencesByArticle, setSentencesByArticle] = useState<Record<string, DBSentence[]>>({})
  const [loadingArticles, setLoadingArticles] = useState<Set<string>>(new Set())
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

  // sentence modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DBSentence | null>(null)
  const [nextArticleId, setNextArticleId] = useState<string | undefined>()
  const [modalKey, setModalKey] = useState(0)

  // batch upload modal
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchArticleId, setBatchArticleId] = useState<string | undefined>()

  // article modal
  const [articleModalOpen, setArticleModalOpen] = useState(false)
  const [articleTitle, setArticleTitle] = useState('')
  const [articleTitleError, setArticleTitleError] = useState('')

  const loadArticles = async () => {
    setArticlesLoading(true)
    const data = await fetchArticles()
    setArticles(data)
    setArticlesLoading(false)
  }

  const loadSentencesForArticle = async (articleId: string) => {
    setLoadingArticles(prev => new Set(prev).add(articleId))
    const data = await fetchSentences({ articleId })
    setSentencesByArticle(prev => ({ ...prev, [articleId]: data }))
    setLoadingArticles(prev => { const s = new Set(prev); s.delete(articleId); return s })
  }

  const refreshArticleSentences = (articleId: string) => loadSentencesForArticle(articleId)

  useEffect(() => { loadArticles() }, [])

  const handleExpand = (expanded: boolean, record: DBArticle) => {
    if (expanded) {
      setExpandedRowKeys(prev => [...prev, record.id])
      if (!sentencesByArticle[record.id]) loadSentencesForArticle(record.id)
    } else {
      setExpandedRowKeys(prev => prev.filter(k => k !== record.id))
    }
  }

  const handleSentenceModalOk = async (data: SentenceFormData, keepOpen = false) => {
    let ok: boolean
    if (editing) {
      ok = await updateSentence(editing.id, data)
    } else {
      ok = await createSentence(data)
    }
    if (ok) {
      toast.success(editing ? '更新成功' : '创建成功')
      refreshArticleSentences(data.articleId)
      if (keepOpen) {
        setNextArticleId(data.articleId)
        setModalKey(k => k + 1)
      } else {
        setModalOpen(false)
        setEditing(null)
        setNextArticleId(undefined)
      }
    } else {
      toast.error('操作失败，请重试')
    }
  }

  const handleDeleteSentence = async (sentence: DBSentence) => {
    const ok = await deleteSentence(sentence.id)
    if (ok) {
      toast.success('删除成功')
      refreshArticleSentences(sentence.articleId)
    } else {
      toast.error('删除失败')
    }
  }

  const handleDeleteArticle = async (record: DBArticle) => {
    const ok = await deleteArticle(record.id)
    if (ok) { toast.success('删除成功'); loadArticles() }
    else toast.error('删除失败')
  }

  const handleCreateArticle = async () => {
    if (!articleTitle.trim()) {
      setArticleTitleError('请输入文章标题')
      return
    }
    const ok = await createArticle(articleTitle.trim())
    if (ok) {
      toast.success('文章创建成功')
      setArticleModalOpen(false)
      loadArticles()
    } else {
      toast.error('创建失败，请重试')
    }
  }

  const openArticleModal = () => {
    setArticleTitle('')
    setArticleTitleError('')
    setArticleModalOpen(true)
  }

  const renderSentenceList = (articleId: string) => {
    if (loadingArticles.has(articleId)) {
      return (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={`sent-skel-${i}`} className="space-y-1.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3.5 w-2/5" />
            </div>
          ))}
        </div>
      )
    }
    const sentences = sentencesByArticle[articleId] || []
    if (sentences.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">
          暂无句子，点击「新建句子」或「批量上传」添加
        </p>
      )
    }
    return (
      <ul className="divide-y divide-border/60">
        {sentences.map(sentence => (
          <li key={sentence.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed">{renderContent(sentence.content)}</p>
              {sentence.translate && (
                <p className="mt-0.5 text-sm text-muted-foreground">{sentence.translate}</p>
              )}
            </div>
            <span className="hidden shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums sm:block">
              {formatDate(sentence.createdAt)}
            </span>
            <div className="inline-flex shrink-0 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="编辑"
                    onClick={() => { setEditing(sentence); setNextArticleId(sentence.articleId); setModalOpen(true) }}
                  >
                    <Pencil />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>编辑</TooltipContent>
              </Tooltip>
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="删除">
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>删除</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除？</AlertDialogTitle>
                    <AlertDialogDescription>此操作不可撤销。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => handleDeleteSentence(sentence)}
                    >
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      {/* 工具栏 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={openArticleModal}>
          <Plus />
          新建文章
        </Button>
        <Button
          onClick={() => { setEditing(null); setNextArticleId(undefined); setModalKey(k => k + 1); setModalOpen(true) }}
        >
          <Plus />
          新建句子
        </Button>
        <Button variant="outline" onClick={() => { setBatchArticleId(undefined); setBatchOpen(true) }}>
          <Upload />
          批量上传
        </Button>
      </div>

      {/* 文章卡片列表 */}
      {articlesLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <Card key={`skel-${i}`} className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="ml-auto h-7 w-28 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <FilePlus2 className="size-6" />
            </div>
            <p className="text-base font-medium">还没有文章</p>
            <p className="text-sm text-muted-foreground">
              点击「新建文章」开始，再往里面添加要练习的句子。
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupByMonth(articles).map(group => (
            <section key={group.label} className="space-y-3">
              <div className="flex items-baseline gap-2 px-1">
                <h2 className="text-sm font-semibold">{group.label}</h2>
                <span className="text-xs text-muted-foreground">{group.items.length} 篇</span>
              </div>
              <div className="space-y-3">
                {group.items.map(record => {
                  const expanded = expandedRowKeys.includes(record.id)
                  return (
                    <Card key={record.id} className="overflow-hidden py-0">
                {/* 文章头：点击标题区展开/收起 */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleExpand(!expanded, record)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </span>
                    <span className="truncate font-medium">{record.title}</span>
                    <span className="ml-1 hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
                      {formatDate(record.createdAt)}
                    </span>
                  </button>
                  <div className="inline-flex shrink-0 gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-primary"
                          aria-label="练习"
                          onClick={() => onPractice(record.id)}
                        >
                          <ListChecks />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>练习</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="新建句子"
                          onClick={() => { setEditing(null); setNextArticleId(record.id); setModalKey(k => k + 1); setModalOpen(true) }}
                        >
                          <FilePlus2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>新建句子</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="批量上传"
                          onClick={() => { setBatchArticleId(record.id); setBatchOpen(true) }}
                        >
                          <Upload />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>批量上传</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="删除">
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除「{record.title}」？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除文章后，其下句子也将一并移除，此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleDeleteArticle(record)}
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* 展开：句子列表 */}
                {expanded && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    {renderSentenceList(record.id)}
                  </div>
                )}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <BatchUploadModal
        open={batchOpen}
        articles={articles}
        initialArticleId={batchArticleId}
        onOk={async (rows) => {
          const { count, error } = await batchCreateSentences(rows)
          if (error) {
            toast.error(`上传失败：${error}`)
          } else {
            toast.success(`成功上传 ${count} 条句子`)
            setBatchOpen(false)
            if (rows[0]?.articleId) refreshArticleSentences(rows[0].articleId)
          }
        }}
        onCancel={() => setBatchOpen(false)}
      />

      {/* 新建文章弹窗 */}
      <Dialog open={articleModalOpen} onOpenChange={o => { if (!o) setArticleModalOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文章</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="article-title">
              文章标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="article-title"
              placeholder="输入文章标题"
              value={articleTitle}
              aria-invalid={!!articleTitleError}
              onChange={e => { setArticleTitle(e.target.value); if (articleTitleError) setArticleTitleError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateArticle() }}
            />
            {articleTitleError && <p className="text-sm text-destructive">{articleTitleError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleModalOpen(false)}>取消</Button>
            <Button onClick={handleCreateArticle}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SentenceModal
        key={modalKey}
        open={modalOpen}
        sentence={editing}
        initialArticleId={nextArticleId}
        articles={articles}
        onOk={handleSentenceModalOk}
        onCancel={() => { setModalOpen(false); setEditing(null); setNextArticleId(undefined) }}
      />
    </>
  )
}
