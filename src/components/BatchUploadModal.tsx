import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DBArticle, SentenceFormData } from '../types/index'

interface ParsedRow { content: string; translate: string }
interface Props {
  open: boolean
  articles: DBArticle[]
  initialArticleId?: string
  onOk: (rows: SentenceFormData[]) => Promise<void>
  onCancel: () => void
}

function parseTxt(text: string): ParsedRow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.trim().split(/\n[ \t]*\n/)
  return blocks
    .map(block => {
      const lines = block.trim().split('\n')
      return { content: lines[0]?.trim() ?? '', translate: lines[1]?.trim() ?? '' }
    })
    .filter(row => row.content)
}

export default function BatchUploadModal({ open, articles, initialArticleId, onOk, onCancel }: Props) {
  const [articleId, setArticleId] = useState<string | undefined>(initialArticleId)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setArticleId(initialArticleId); setRows([]); setParseError('') } }, [open, initialArticleId])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const parsed = parseTxt((e.target?.result as string) ?? '')
      if (parsed.length === 0) { setParseError('未解析到有效句子，请检查文件格式'); setRows([]) }
      else { setParseError(''); setRows(parsed) }
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleOk = async () => {
    if (!articleId || rows.length === 0) return
    setSubmitting(true)
    await onOk(rows.map(r => ({ content: r.content, translate: r.translate, articleId })))
    setSubmitting(false)
    setRows([]); setArticleId(undefined)
  }

  const handleCancel = () => { setRows([]); setArticleId(undefined); setParseError(''); onCancel() }

  const selectedArticle = articles.find(a => a.id === articleId)

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleCancel() }}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>批量上传句子</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 所属文章 */}
          <div className="flex flex-col gap-1.5">
            <Label>
              所属文章 <span className="text-destructive">*</span>
            </Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal"
                >
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
                          onSelect={() => {
                            setArticleId(a.id)
                            setPickerOpen(false)
                          }}
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
          </div>

          {/* 上传区 */}
          <div className="flex flex-col gap-1.5">
            <Label>上传 txt 文件</Label>
            <div
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border border-dashed p-7 text-center transition-colors cursor-pointer hover:bg-accent',
                dragOver && 'border-primary bg-accent',
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) handleFile(file)
              }}
            >
              <Upload className="size-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">点击或拖拽 txt 文件到此处</p>
              <p className="text-xs text-muted-foreground">
                每条句子占两行：第1行内容，第2行翻译，句子之间用空行分隔
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          {parseError && <p className="text-sm text-destructive">{parseError}</p>}

          {rows.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>预览（共 {rows.length} 条）</Label>
              <div className="max-h-[220px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>句子内容</TableHead>
                      <TableHead className="w-[200px]">中文翻译</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-normal">{r.content}</TableCell>
                        <TableCell className="whitespace-normal">{r.translate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>取消</Button>
          <Button
            disabled={!articleId || rows.length === 0 || submitting}
            onClick={handleOk}
          >
            上传 {rows.length > 0 ? `(${rows.length} 条)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
