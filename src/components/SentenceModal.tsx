import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import type { DBArticle, DBSentence, SentenceFormData } from '../types/index'

interface Props {
  open: boolean
  sentence?: DBSentence | null
  initialArticleId?: string
  articles: DBArticle[]
  onOk: (data: SentenceFormData, keepOpen?: boolean) => void
  onCancel: () => void
}

export default function SentenceModal({ open, sentence, initialArticleId, articles, onOk, onCancel }: Props) {
  const isEditing = !!sentence
  const [articleId, setArticleId] = useState<string | undefined>()
  const [content, setContent] = useState('')
  const [translate, setTranslate] = useState('')
  const [errors, setErrors] = useState<{ articleId?: string; content?: string }>({})
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setArticleId(sentence ? sentence.articleId : initialArticleId)
      setContent(sentence?.content ?? '')
      setTranslate(sentence?.translate ?? '')
      setErrors({})
    }
  }, [open, sentence, initialArticleId])

  const submit = (keepOpen: boolean) => {
    const err: typeof errors = {}
    if (!articleId) err.articleId = '请选择文章'
    if (!content.trim()) err.content = '请输入句子内容'
    setErrors(err)
    if (Object.keys(err).length) return
    onOk({ articleId: articleId!, content, translate }, keepOpen)
  }

  const selectedArticle = articles.find(a => a.id === articleId)

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑句子' : '新建句子'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 所属文章 */}
          <div className="flex flex-col gap-1.5">
            <Label>
              所属文章 <span className="text-destructive">*</span>
            </Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild disabled={isEditing}>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  aria-invalid={!!errors.articleId}
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
                            setErrors(prev => ({ ...prev, articleId: undefined }))
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
            {errors.articleId && <p className="text-sm text-destructive">{errors.articleId}</p>}
          </div>

          {/* 句子内容 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sentence-content">
              句子内容 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="sentence-content"
              rows={3}
              placeholder="I have a (pen-笔)"
              value={content}
              aria-invalid={!!errors.content}
              onChange={e => {
                setContent(e.target.value)
                if (errors.content) setErrors(prev => ({ ...prev, content: undefined }))
              }}
            />
            <p className="text-xs text-muted-foreground">括号格式：I have a (pen-笔)</p>
            {errors.content && <p className="text-sm text-destructive">{errors.content}</p>}
          </div>

          {/* 中文翻译 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sentence-translate">中文翻译</Label>
            <Textarea
              id="sentence-translate"
              rows={2}
              placeholder="我有一支笔"
              value={translate}
              onChange={e => setTranslate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          {!isEditing && <Button variant="outline" onClick={() => submit(true)}>创建下一个</Button>}
          <Button onClick={() => submit(false)}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
