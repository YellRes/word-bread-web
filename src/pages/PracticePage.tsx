import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, ChevronsUpDown, RotateCcw, ListChecks, Volume2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { parseContent, hasBlanks, normalizeAnswer, toPlainSentence } from '@/lib/annotation'
import { speak } from '@/lib/speech'
import { fetchArticles } from '../services/articleService'
import { fetchSentences } from '../services/sentenceService'
import { recordPractice } from '../services/practiceService'
import { upsertReview } from '../services/reviewService'
import type { DBArticle, DBSentence } from '../types/index'

type Phase = 'select' | 'practicing' | 'summary'

interface Props {
  /** 由「练习」按钮指定的文章，提供时进入页面自动开练 */
  initialArticleId?: string
  /** 指定句子集（如错题本重练）。提供时优先于 initialArticleId，直接练这批句子 */
  customSentences?: DBSentence[]
  /** 指定句子集时显示的标题（如「错题重练」） */
  customTitle?: string
  /** 每次点击「练习」按钮递增，用于触发（重新）自动开练 */
  practiceNonce?: number
}

export default function PracticePage({ initialArticleId, customSentences, customTitle, practiceNonce }: Props) {
  const [articles, setArticles] = useState<DBArticle[]>([])
  const [articleId, setArticleId] = useState<string>(initialArticleId ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)

  const [sentences, setSentences] = useState<DBSentence[]>([])
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<Phase>('select')

  const [index, setIndex] = useState(0)
  const [inputs, setInputs] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [blankResults, setBlankResults] = useState<boolean[]>([])
  const [wordShown, setWordShown] = useState<boolean[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  const [sessionTitle, setSessionTitle] = useState('')

  useEffect(() => { fetchArticles().then(setArticles) }, [])

  const current = sentences[index]
  const segments = useMemo(
    () => (current ? parseContent(current.content) : []),
    [current]
  )
  const blanks = useMemo(
    () => segments.filter((s): s is Extract<typeof s, { type: 'blank' }> => s.type === 'blank'),
    [segments]
  )

  // 切句时重置作答态
  useEffect(() => {
    setInputs(Array(blanks.length).fill(''))
    setChecked(false)
    setRevealed(false)
    setBlankResults([])
    setWordShown(Array(blanks.length).fill(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id])

  const selectedArticle = articles.find(a => a.id === articleId)
  // 标题：自定义会话用快照标题；按文章练习时回退到响应式的文章标题（应对 articles 后加载）
  const headerTitle = sessionTitle || selectedArticle?.title || ''

  const beginPractice = (list: DBSentence[], title: string) => {
    setSentences(list)
    setSessionTitle(title)
    setIndex(0)
    setCorrectCount(0)
    setPhase('practicing')
  }

  const startPractice = async (id: string = articleId) => {
    if (!id) return
    setArticleId(id)
    setLoading(true)
    const data = await fetchSentences({ articleId: id })
    setLoading(false)
    const practiceable = data.filter(s => hasBlanks(s.content))
    if (practiceable.length === 0) {
      toast.info('这篇文章没有可练习的标注词')
      return
    }
    beginPractice(practiceable, articles.find(a => a.id === id)?.title ?? '')
  }

  // 从「练习」按钮进入：每次 nonce 变化（含首次挂载）自动开练。
  // 优先用传入的句子集（错题本重练），否则按指定文章 fetch。
  useEffect(() => {
    if (customSentences && customSentences.length > 0) {
      setArticleId('')
      beginPractice(customSentences, customTitle ?? '错题重练')
    } else if (initialArticleId) {
      startPractice(initialArticleId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceNonce])

  const persist = (isCorrect: boolean, correctBlanks: number, wasRevealed: boolean) => {
    if (!current) return
    recordPractice({
      sentenceId: current.id,
      articleId: current.articleId,
      isCorrect,
      totalBlanks: blanks.length,
      correctBlanks,
      revealed: wasRevealed,
    }).then(ok => {
      if (!ok) toast.error('进度保存失败，但不影响继续练习')
    })
    // 更新 SM-2 间隔重复状态（对抗遗忘）；失败仅记录日志，不打扰练习
    upsertReview({
      sentenceId: current.id,
      articleId: current.articleId,
      revealed: wasRevealed,
      correctBlanks,
      totalBlanks: blanks.length,
    }).catch(e => console.error('upsertReview failed:', e))
  }

  const handleCheck = () => {
    const results = blanks.map((b, k) => normalizeAnswer(inputs[k] ?? '') === normalizeAnswer(b.answer))
    const correctBlanks = results.filter(Boolean).length
    const allCorrect = correctBlanks === blanks.length
    setBlankResults(results)
    setWordShown(blanks.map(() => true))
    setChecked(true)
    if (allCorrect) {
      setCorrectCount(c => c + 1)
      const isLast = index >= sentences.length - 1
      toast.success(isLast ? '全部答对！查看结果' : '全部答对！进入下一题')
      // 全对后短暂停留让用户看到绿色反馈，再自动进入下一题
      window.setTimeout(() => handleNext(), 900)
    } else {
      toast.error(`还有 ${blanks.length - correctBlanks} 个填错了，看看正确答案`)
    }
    persist(allCorrect, correctBlanks, false)
  }

  const handleReveal = () => {
    // 在覆盖输入前先算每个空的对错（用于复盘），显示答案整句计为未掌握
    const results = blanks.map((b, k) => normalizeAnswer(inputs[k] ?? '') === normalizeAnswer(b.answer))
    setBlankResults(results)
    setWordShown(blanks.map(() => true))
    setInputs(blanks.map(b => b.answer))
    setRevealed(true)
    setChecked(true)
    persist(false, results.filter(Boolean).length, true)
  }

  const toggleWord = (k: number) =>
    setWordShown(prev => prev.map((v, i) => (i === k ? !v : v)))

  const handleNext = () => {
    if (index < sentences.length - 1) setIndex(i => i + 1)
    else setPhase('summary')
  }

  const restart = () => {
    setIndex(0)
    setCorrectCount(0)
    setPhase('practicing')
  }

  const backToSelect = () => {
    setPhase('select')
    setSentences([])
  }

  // ---- select ----
  if (phase === 'select') {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ListChecks className="size-5 text-primary" />
              挖词填空练习
            </div>
            <p className="text-sm text-muted-foreground">
              选择一篇文章，把句子里的重点词挖空填回去。
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <Label>选择文章</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={pickerOpen} className="w-full justify-between font-normal">
                  <span className={cn(!selectedArticle && 'text-muted-foreground')}>
                    {selectedArticle ? selectedArticle.title : '选择文章'}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索文章..." />
                  <CommandList>
                    <CommandEmpty>无匹配</CommandEmpty>
                    <CommandGroup>
                      {articles.map(a => (
                        <CommandItem
                          key={a.id}
                          value={a.title}
                          onSelect={() => { setArticleId(a.id); setPickerOpen(false) }}
                        >
                          <Check className={cn('mr-2', articleId === a.id ? 'opacity-100' : 'opacity-0')} />
                          {a.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={!articleId || loading} onClick={() => startPractice()}>
              {loading ? '加载中…' : '开始练习'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ---- summary ----
  if (phase === 'summary') {
    const total = sentences.length
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold">练习完成 🎉</div>
            <p className="text-sm text-muted-foreground">{headerTitle}</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 py-8 text-center">
              <div className="text-4xl font-bold text-primary">{correctCount}/{total}</div>
              <p className="mt-1 text-sm text-muted-foreground">句完全答对</p>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button className="flex-1" onClick={restart}>
              <RotateCcw />
              再练一次
            </Button>
            <Button variant="outline" className="flex-1" onClick={backToSelect}>
              换文章
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ---- practicing ----
  if (loading || !current) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  let blankIdx = -1
  const allCorrect = checked && !revealed && blankResults.every(Boolean)
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2.5 flex items-center justify-between text-sm text-muted-foreground">
        <span className="truncate pr-4">{headerTitle}</span>
        <span className="shrink-0 tabular-nums">{index + 1} / {sentences.length}</span>
      </div>
      <Progress value={((index + (checked ? 1 : 0)) / sentences.length) * 100} className="mb-5 h-1.5" />

      <Card className="shadow-sm">
        <CardContent className="px-6 py-7 sm:px-8">
          {/* 朗读按钮 */}
          <div className="mb-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-primary"
              onClick={() => speak(toPlainSentence(current.content))}
              aria-label="播放整句读音"
              title="播放整句读音"
            >
              <Volume2 />
            </Button>
          </div>

          {/* 句子：挖空默认隐藏（空白），中文提示在下方「生词」区按需查看 */}
          <p className="text-[1.35rem] leading-[2.1] tracking-tight">
            {segments.map((seg, i) => {
              if (seg.type === 'text') return <span key={i}>{seg.value}</span>
              const k = ++blankIdx
              const ok = checked && blankResults[k]
              const wrong = checked && !blankResults[k]
              const w = Math.max(seg.answer.length + 2, 6)
              return (
                <input
                  key={i}
                  value={inputs[k] ?? ''}
                  disabled={checked}
                  onChange={e => setInputs(prev => prev.map((v, idx) => (idx === k ? e.target.value : v)))}
                  onKeyDown={e => { if (e.key === 'Enter' && !checked) handleCheck() }}
                  className={cn(
                    'mx-1 inline-block border-b-[1.5px] bg-transparent px-1 text-center align-baseline text-[1.05rem] outline-none transition-colors',
                    !checked && 'border-muted-foreground/30 focus:border-primary',
                    ok && 'border-green-600 font-medium text-green-700',
                    wrong && 'border-destructive font-medium text-destructive'
                  )}
                  style={{ width: `${w}ch` }}
                  aria-label={`填空：${seg.hint || '单词'}`}
                />
              )
            })}
          </p>

          {current.translate && (
            <p className="mt-6 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
              {current.translate}
            </p>
          )}

          {/* 生词：逐词读音 + 单词显示；检查后自动揭示并标对错 */}
          <div className="mt-5 rounded-lg bg-muted/40 p-3">
            <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">生词</div>
            <ul className="space-y-1.5">
              {blanks.map((b, k) => {
                const shown = wordShown[k]
                return (
                  <li key={k} className="flex items-center gap-2 text-sm">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 shrink-0 text-muted-foreground hover:text-primary"
                      onClick={() => speak(b.answer, 0.7)}
                      aria-label="播放单词读音"
                      title="播放单词读音"
                    >
                      <Volume2 />
                    </Button>
                    {checked &&
                      (blankResults[k] ? (
                        <Check className="size-4 shrink-0 text-green-600" />
                      ) : (
                        <X className="size-4 shrink-0 text-destructive" />
                      ))}
                    <span className="shrink-0 text-muted-foreground">{b.hint}</span>
                    <span className="text-muted-foreground/40">·</span>
                    {shown ? (
                      <span className="font-medium">{b.answer}</span>
                    ) : (
                      <span className="select-none tracking-[0.3em] text-muted-foreground/40">••••</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto size-7 shrink-0 text-muted-foreground hover:text-primary"
                      onClick={() => toggleWord(k)}
                      aria-label={shown ? '隐藏单词' : '显示单词'}
                      title={shown ? '隐藏' : '显示'}
                    >
                      {shown ? <EyeOff /> : <Eye />}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-sm font-medium">
            {allCorrect && <span className="text-green-600">答对了 ✓</span>}
            {checked && !allCorrect && <span className="text-muted-foreground">继续加油</span>}
          </span>
          <div className="flex gap-2">
            {!checked ? (
              <>
                <Button variant="ghost" onClick={handleReveal}>显示答案</Button>
                <Button onClick={handleCheck}>检查</Button>
              </>
            ) : (
              <Button onClick={handleNext}>
                {index < sentences.length - 1 ? '下一句' : '查看结果'}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
