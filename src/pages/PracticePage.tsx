import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, ChevronsUpDown, RotateCcw, ListChecks, Volume2, Eye, EyeOff, Trophy } from 'lucide-react'
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
import { recordPractice, recordBlankAttempts } from '../services/practiceService'
import { upsertReview } from '../services/reviewService'
import type { DBArticle, DBSentence } from '../types/index'

type Phase = 'select' | 'practicing' | 'summary'
type Stage = 'first' | 'retry' | 'done'

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
  // 单句作答阶段：first=首次填空 / retry=首检有错、给提示再试一次 / done=已揭示锁定
  const [stage, setStage] = useState<Stage>('first')
  const [firstResults, setFirstResults] = useState<boolean[]>([]) // 首次作答对错（落库口径）
  const [solved, setSolved] = useState<boolean[]>([]) // 每空是否已"边输入边判定"答对并锁定
  const [revealed, setRevealed] = useState(false)
  const [blankResults, setBlankResults] = useState<boolean[]>([])
  const [wordShown, setWordShown] = useState<boolean[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  const [sessionTitle, setSessionTitle] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const advanceTimer = useRef<number | null>(null)
  const checked = stage === 'done' // 兼容旧渲染判定：done 即"已检查/已锁定"

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

  // 切句时重置作答态 + 自动聚焦第一个空
  useEffect(() => {
    setInputs(Array(blanks.length).fill(''))
    setStage('first')
    setFirstResults([])
    setSolved(Array(blanks.length).fill(false))
    setRevealed(false)
    setBlankResults([])
    setWordShown(Array(blanks.length).fill(false))
    // 清理上一句可能挂着的自动跳题计时器
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    // 渲染后聚焦第一个空（延后到挂载/夺焦修正之后，跳题更稳）
    const id = window.setTimeout(() => inputRefs.current[0]?.focus(), 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id])

  // 卸载时清理待跳题计时器
  useEffect(() => () => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current)
  }, [])

  // 提示串：首字母 + 其余用占位点（如 probe → p····）
  const hintPlaceholder = (answer: string) =>
    answer.length <= 1 ? answer : answer[0] + '·'.repeat(answer.length - 1)

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

  // 首次落库（且只此一次）：PracticeRecord + SM-2 + BlankAttempt，全部用首次结果
  const persistFirst = (results: boolean[], wasRevealed: boolean) => {
    if (!current) return
    const correctBlanks = results.filter(Boolean).length
    const allCorrect = correctBlanks === blanks.length && !wasRevealed
    recordPractice({
      sentenceId: current.id,
      articleId: current.articleId,
      isCorrect: allCorrect,
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
    // 词级落库（易错榜数据源）；失败仅记录日志
    recordBlankAttempts({
      sentenceId: current.id,
      articleId: current.articleId,
      blanks: blanks.map(b => ({ word: b.answer, hint: b.hint })),
      firstResults: results,
      revealed: wasRevealed,
    }).catch(e => console.error('recordBlankAttempts failed:', e))
  }

  // 全对收尾：首次落库（全对）+ 成功提示 + 自动跳题。供"边输入边校验"与点「检查」共用。
  const finishAllCorrect = () => {
    const results = blanks.map(() => true)
    setFirstResults(results)
    setBlankResults(results)
    setWordShown(blanks.map(() => true))
    persistFirst(results, false)
    setCorrectCount(c => c + 1)
    const isLast = index >= sentences.length - 1
    toast.success(isLast ? '全部答对！查看结果' : '全部答对！进入下一题')
    setStage('done')
    advanceTimer.current = window.setTimeout(() => handleNext(), 900)
  }

  // 边输入边校验：某空打对就标绿锁定、跳下个空；全部打对自动收尾（first 落库 / retry 仅揭示）
  const handleBlankInput = (k: number, val: string, answer: string) => {
    setInputs(prev => prev.map((v, idx) => (idx === k ? val : v)))
    if (stage === 'done') return
    if (normalizeAnswer(val) !== normalizeAnswer(answer)) return
    const base = solved.length === blanks.length ? solved : blanks.map(() => false)
    const nextSolved = base.map((v, idx) => (idx === k ? true : v))
    setSolved(nextSolved)
    if (nextSolved.every(Boolean)) {
      if (stage === 'first') finishAllCorrect()
      else { setBlankResults(blanks.map(() => true)); setWordShown(blanks.map(() => true)); setStage('done') }
      return
    }
    // 跳到下一个未解决的空
    requestAnimationFrame(() => {
      const next = inputRefs.current.findIndex((el, idx) => idx > k && el && !el.disabled)
      if (next !== -1) inputRefs.current[next]?.focus()
    })
  }

  const handleCheck = () => {
    const results = blanks.map((b, k) => normalizeAnswer(inputs[k] ?? '') === normalizeAnswer(b.answer))
    if (results.every(Boolean)) { setSolved(results); finishAllCorrect(); return }
    setFirstResults(results)
    setBlankResults(results)
    setWordShown(blanks.map(() => true))
    setSolved(results) // 已对的锁定，错的可改
    persistFirst(results, false) // 只在首次检查落库
    // 进入重试态：清空答错的空，露出首字母提示；答对的空保持只读+绿
    setStage('retry')
    setInputs(prev => prev.map((v, k) => (results[k] ? v : '')))
    toast.error(`还有 ${results.filter(r => !r).length} 个填错了，给了首字母再试一次`)
    requestAnimationFrame(() => {
      const firstWrong = results.findIndex(r => !r)
      if (firstWrong !== -1) inputRefs.current[firstWrong]?.focus()
    })
  }

  const handleRetryCheck = () => {
    // 重试不再落库；揭示完整答案并标记
    const results = blanks.map((b, k) => normalizeAnswer(inputs[k] ?? '') === normalizeAnswer(b.answer))
    setBlankResults(results)
    setWordShown(blanks.map(() => true))
    setStage('done')
  }

  const handleReveal = () => {
    // 在覆盖输入前先算每个空的对错（用于复盘），显示答案整句计为未掌握
    const results = blanks.map((b, k) => normalizeAnswer(inputs[k] ?? '') === normalizeAnswer(b.answer))
    setBlankResults(results)
    setWordShown(blanks.map(() => true))
    setInputs(blanks.map(b => b.answer))
    setRevealed(true)
    if (stage === 'first') {
      setFirstResults(results)
      persistFirst(results, true) // 第一阶段就放弃 → 按 revealed 落库
    }
    setStage('done')
  }

  // Enter 主操作：按当前阶段决定"检查 / 重试检查 / 下一句"
  const handlePrimaryAction = () => {
    if (stage === 'first') handleCheck()
    else if (stage === 'retry') handleRetryCheck()
    else handleNext()
  }

  const toggleWord = (k: number) =>
    setWordShown(prev => prev.map((v, i) => (i === k ? !v : v)))

  const handleNext = () => {
    if (advanceTimer.current !== null) { clearTimeout(advanceTimer.current); advanceTimer.current = null }
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
    const pct = total ? Math.round((correctCount / total) * 100) : 0
    return (
      <div className="mx-auto max-w-xl">
        <Card className="anim-rise">
          <CardHeader>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Trophy className="size-5" />
              </span>
              练习完成
            </div>
            <p className="text-sm text-muted-foreground">{headerTitle}</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-muted/30 py-8 text-center">
              <div className="text-4xl font-bold tabular-nums text-primary">
                {correctCount}<span className="text-2xl text-muted-foreground">/{total}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">句完全答对 · 正确率 {pct}%</p>
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
  const allCorrect = stage === 'done' && !revealed && firstResults.length > 0 && firstResults.every(Boolean)
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
              // 已对（含边输入即对/首检对/重试前已对）即标绿并锁定
              const correctShown = solved[k] || (stage === 'done' && blankResults[k]) || (stage === 'retry' && firstResults[k])
              const locked = correctShown || stage === 'done'
              const ok = correctShown
              const wrong = stage === 'done' && !blankResults[k]
              const w = Math.max(seg.answer.length + 2, 6)
              return (
                <input
                  key={`${current.id}-${i}`}
                  ref={el => { inputRefs.current[k] = el }}
                  autoFocus={k === 0}
                  value={inputs[k] ?? ''}
                  disabled={locked}
                  placeholder={stage === 'retry' && !firstResults[k] ? hintPlaceholder(seg.answer) : undefined}
                  onChange={e => handleBlankInput(k, e.target.value, seg.answer)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handlePrimaryAction() }
                    else if (e.key === 'Tab' && !e.shiftKey) {
                      const next = inputRefs.current.findIndex((el, idx) => idx > k && el && !el.disabled)
                      if (next !== -1) { e.preventDefault(); inputRefs.current[next]?.focus() }
                    }
                  }}
                  className={cn(
                    'mx-1 inline-block border-b-[1.5px] bg-transparent px-1 text-center align-baseline text-[1.05rem] outline-none transition-colors placeholder:text-muted-foreground/40 placeholder:tracking-widest',
                    !locked && 'border-muted-foreground/30 focus:border-primary',
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
            {stage === 'retry' && <span className="text-muted-foreground">给了首字母，再试一次</span>}
            {stage === 'done' && !allCorrect && <span className="text-muted-foreground">继续加油</span>}
          </span>
          <div className="flex gap-2">
            {stage === 'first' && (
              <>
                <Button variant="ghost" onClick={handleReveal}>显示答案</Button>
                <Button onClick={handleCheck}>检查</Button>
              </>
            )}
            {stage === 'retry' && (
              <>
                <Button variant="ghost" onClick={handleReveal}>显示答案</Button>
                <Button onClick={handleRetryCheck}>再检查</Button>
              </>
            )}
            {stage === 'done' && (
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
