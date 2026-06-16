import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Upload, ChevronRight, ChevronDown, ListChecks } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
            className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.92em] font-semibold text-amber-800"
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

  const renderSentenceRows = (articleId: string) => {
    if (loadingArticles.has(articleId)) {
      return [0, 1].map(i => (
        <TableRow key={`sent-skel-${i}`}>
          <TableCell><Skeleton className="h-4 w-3/5" /></TableCell>
          <TableCell><Skeleton className="h-4 w-2/5" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        </TableRow>
      ))
    }
    const sentences = sentencesByArticle[articleId] || []
    if (sentences.length === 0) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
            暂无句子，点击「新建句子」或「批量上传」添加
          </TableCell>
        </TableRow>
      )
    }
    return sentences.map(sentence => (
      <TableRow key={sentence.id}>
        <TableCell className="whitespace-normal">{renderContent(sentence.content)}</TableCell>
        <TableCell className="w-[220px] whitespace-normal text-muted-foreground">{sentence.translate}</TableCell>
        <TableCell className="w-[100px]">
          <div className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditing(sentence); setNextArticleId(sentence.articleId); setModalOpen(true) }}
            >
              编辑
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">删除</Button>
              </AlertDialogTrigger>
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
        </TableCell>
      </TableRow>
    ))
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

      {/* 文章表 */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10" aria-hidden />
              <TableHead>文章标题</TableHead>
              <TableHead className="w-[340px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articlesLoading ? (
              [0, 1, 2].map(i => (
                <TableRow key={`skel-${i}`} className="hover:bg-transparent">
                  <TableCell />
                  <TableCell><Skeleton className="h-4 w-2/5" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-3/5" /></TableCell>
                </TableRow>
              ))
            ) : articles.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  暂无文章，点击「新建文章」开始
                </TableCell>
              </TableRow>
            ) : (
              articles.map(record => {
                const expanded = expandedRowKeys.includes(record.id)
                return (
                  <FragmentRow key={record.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={expanded ? '收起' : '展开'}
                          onClick={() => handleExpand(!expanded, record)}
                        >
                          {expanded ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{record.title}</TableCell>
                      <TableCell>
                        <div className="inline-flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            onClick={() => onPractice(record.id)}
                          >
                            <ListChecks />
                            练习
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditing(null); setNextArticleId(record.id); setModalKey(k => k + 1); setModalOpen(true) }}
                          >
                            新建句子
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setBatchArticleId(record.id); setBatchOpen(true) }}
                          >
                            <Upload />
                            批量上传
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">删除</Button>
                            </AlertDialogTrigger>
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
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="bg-muted/30 p-0">
                          <div className="px-3 py-2">
                            <div className="rounded-lg border bg-card">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead>句子内容</TableHead>
                                    <TableHead className="w-[220px]">中文翻译</TableHead>
                                    <TableHead className="w-[100px]">操作</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {renderSentenceRows(record.id)}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </FragmentRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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

// 让一个 article 行 + 其展开行作为一组（React.Fragment 透传 key）
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
