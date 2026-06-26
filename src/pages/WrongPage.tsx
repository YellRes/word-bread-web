import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, RotateCcw, Volume2, Sparkles, AlarmClock, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { parseContent, toPlainSentence } from '@/lib/annotation'
import { formatDue } from '@/lib/format'
import { speak } from '@/lib/speech'
import { backfillReviewStates, fetchReviewItems } from '../services/reviewService'
import type { DBSentence, ReviewItem } from '../types/index'

interface Props {
  /** 重练入口：把句子集交回 App 启动 cloze 练习 */
  onPractice: (sentences: DBSentence[], title: string) => void
}

/** 把 (单词-中文) 渲染为琥珀高亮的英文答案，便于复习时直接看到错词 */
function renderReview(content: string) {
  return (
    <span>
      {parseContent(content).map((seg, i) =>
        seg.type === 'blank' ? (
          <span
            key={i}
            className="mx-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.92em] font-semibold text-primary"
          >
            {seg.answer}
          </span>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </span>
  )
}

function ReviewRow({ it, onPractice }: { it: ReviewItem; onPractice: Props['onPractice'] }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">{it.articleTitle}</Badge>
          <Badge
            variant="outline"
            className={cn(
              'gap-1',
              it.due ? 'border-amber-500/40 text-amber-600' : 'text-muted-foreground'
            )}
          >
            <CalendarClock className="size-3" />
            {formatDue(it.state.nextReviewAt)}
          </Badge>
          {it.state.lapses > 0 && (
            <span className="text-xs text-muted-foreground">遗忘 {it.state.lapses} 次</span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground hover:text-primary"
            onClick={() => speak(toPlainSentence(it.sentence.content))}
            aria-label="播放整句读音"
            title="播放整句读音"
          >
            <Volume2 />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary"
            onClick={() => onPractice([it.sentence], `复习 · ${it.articleTitle}`)}
          >
            练习
          </Button>
        </div>

        <p className="text-[1.05rem] leading-relaxed">{renderReview(it.sentence.content)}</p>

        {it.sentence.translate && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.sentence.translate}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function WrongPage({ onPractice }: Props) {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterId, setFilterId] = useState<string>('all') // 'all' 或 articleId
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = () => {
    setLoading(true)
    // 先回填历史错题，再拉队列
    backfillReviewStates()
      .then(fetchReviewItems)
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const articleOptions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach(it => map.set(it.sentence.articleId, it.articleTitle))
    return [...map.entries()].map(([id, title]) => ({ id, title }))
  }, [items])

  const filtered = useMemo(
    () => (filterId === 'all' ? items : items.filter(it => it.sentence.articleId === filterId)),
    [items, filterId]
  )
  const dueItems = filtered.filter(it => it.due)
  const pendingItems = filtered.filter(it => !it.due)

  const filterLabel =
    filterId === 'all' ? '全部文章' : articleOptions.find(a => a.id === filterId)?.title ?? '全部文章'

  const startReview = () => {
    if (dueItems.length === 0) return
    onPractice(
      dueItems.map(it => it.sentence),
      `今日复习 · ${dueItems.length} 题`
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <p className="text-base font-medium">还没有需要复习的内容</p>
          <p className="text-sm text-muted-foreground">
            去「练习」做几题吧，答错的句子会按间隔重复（对抗遗忘）自动安排复习。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* 工具栏：今日待复习 + 开始复习 + 文章筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-2 text-sm">
          <AlarmClock className={cn('size-4', dueItems.length ? 'text-amber-500' : 'text-muted-foreground')} />
          今日待复习
          <span className={cn('font-semibold tabular-nums', dueItems.length ? 'text-amber-600' : 'text-foreground')}>
            {dueItems.length}
          </span>
          <span className="text-muted-foreground">/ 共 {filtered.length}</span>
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={pickerOpen} className="justify-between font-normal">
              <span className="max-w-[180px] truncate">{filterLabel}</span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="end">
            <Command>
              <CommandInput placeholder="搜索文章..." />
              <CommandList>
                <CommandEmpty>无匹配</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="全部文章" onSelect={() => { setFilterId('all'); setPickerOpen(false) }}>
                    <Check className={cn('mr-2', filterId === 'all' ? 'opacity-100' : 'opacity-0')} />
                    全部文章
                  </CommandItem>
                  {articleOptions.map(a => (
                    <CommandItem
                      key={a.id}
                      value={a.title}
                      onSelect={() => { setFilterId(a.id); setPickerOpen(false) }}
                    >
                      <Check className={cn('mr-2', filterId === a.id ? 'opacity-100' : 'opacity-0')} />
                      {a.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button onClick={startReview} disabled={dueItems.length === 0}>
          <RotateCcw />
          开始复习{dueItems.length > 0 ? `（${dueItems.length}）` : ''}
        </Button>
      </div>

      {/* 今日待复习 */}
      {dueItems.length > 0 && (
        <section className="anim-rise space-y-3">
          <h3 className="text-sm font-semibold text-amber-600">今日待复习</h3>
          <ul className="space-y-3">
            {dueItems.map(it => (
              <li key={it.sentence.id}>
                <ReviewRow it={it} onPractice={onPractice} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 复习中（未到期） */}
      {pendingItems.length > 0 && (
        <section className="anim-rise space-y-3" style={{ animationDelay: '80ms' }}>
          <h3 className="text-sm font-semibold text-muted-foreground">
            复习中 · 已安排
          </h3>
          <ul className="space-y-3">
            {pendingItems.map(it => (
              <li key={it.sentence.id}>
                <ReviewRow it={it} onPractice={onPractice} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
