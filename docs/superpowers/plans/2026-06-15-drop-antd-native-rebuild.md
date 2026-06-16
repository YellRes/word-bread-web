# 去 Ant Design 原生重建 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 Ant Design，用原生 React + 手写 CSS + Radix 无头组件重建 word-bread-web 的全部 UI，保留所有功能与中文文案。

**Architecture:** 新建 `src/components/ui/` 存放原生基础组件（Button/Modal/ConfirmButton/Combobox/FileDropzone/Field/toast/Spinner/Skeleton）；行为/无障碍由 Radix 承担，样式 100% 用 [src/index.css](../../../src/index.css) 现有 `--wb-*` token 手写。App / SentenceModal / BatchUploadModal 改用这些 ui 组件。services / types / txt 解析逻辑零改动。

**Tech Stack:** React 19, Vite, TypeScript, `@radix-ui/react-{dialog,alert-dialog,toast,popover}`, `@phosphor-icons/react`, 手写 CSS。

**验证手段（无测试框架）：** 每个任务的验证 = `npx tsc -b --noEmit` 零错误 +（末尾）`npm run build` 成功 + preview 截图。提交点用 `git add/commit`（**等用户批准后再执行 git，按项目规范不自动 commit**）。

---

## 文件结构

```
src/components/ui/
  Button.tsx          # <button> + 变体 primary/default/link/danger + size + icon + loading
  Modal.tsx           # Radix Dialog 封装：open/onOpenChange/title/footer/children/width
  ConfirmButton.tsx   # Radix AlertDialog：trigger children + title/onConfirm/okText/cancelText/danger
  Combobox.tsx        # Radix Popover + 过滤输入：value/onChange/options/placeholder/disabled
  FileDropzone.tsx    # 原生拖拽 + 隐藏 input[file]：accept/onFile/hint
  Field.tsx           # label + children + error + extra（表单字段壳）
  Spinner.tsx         # 行内转圈
  Skeleton.tsx        # 骨架行
  Alert.tsx           # 行内错误条
  toast.tsx           # ToastProvider + useToast()（基于 @radix-ui/react-toast）
  icons.ts            # 从 @phosphor-icons/react 统一导出 4 个图标，锁定 weight
src/components/SentenceModal.tsx     # 改写：用 ui 组件
src/components/BatchUploadModal.tsx  # 改写：用 ui 组件
src/App.tsx                          # 改写：原生表格 + 工具栏 + header + 文章弹窗
src/main.tsx                         # 去 ConfigProvider，包 ToastProvider
src/index.css                        # 扩展 .wb-* 组件类
```

---

## Task 0: 依赖切换

**Files:** Modify `package.json`（经由 npm 命令）

- [ ] **Step 1: 安装 Radix + Phosphor**

```bash
npm install @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-toast @radix-ui/react-popover @phosphor-icons/react
```

- [ ] **Step 2: 暂不卸载 antd**（最后一个任务确认 src 无引用后再卸，避免中途编译断裂）

- [ ] **Step 3: 验证安装**

Run: `npm ls @radix-ui/react-dialog @phosphor-icons/react`
Expected: 列出已安装版本，无 missing。

---

## Task 1: CSS 基础类（扩展 index.css）

**Files:** Modify `src/index.css`（在现有 token 之后追加组件类）

- [ ] **Step 1: 追加组件类**

在 `.wb-panel` 之后追加（基于现有 `--wb-*` token）：

```css
/* ---- 按钮 ---- */
.wb-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border-radius: var(--wb-radius);
  border: 1px solid var(--wb-border);
  background: var(--wb-surface); color: var(--wb-text);
  font: 500 14px/1 var(--wb-font); cursor: pointer;
  transition: background .15s, border-color .15s, transform .05s;
}
.wb-btn:hover { border-color: #d9d4cc; background: #fdfbf8; }
.wb-btn:active { transform: translateY(1px); }
.wb-btn:disabled { opacity: .5; cursor: not-allowed; }
.wb-btn:focus-visible { outline: 2px solid var(--wb-accent); outline-offset: 2px; }
.wb-btn--primary { background: var(--wb-accent); border-color: var(--wb-accent); color: #fff; }
.wb-btn--primary:hover { background: #a04908; border-color: #a04908; }
.wb-btn--link { height: auto; padding: 0 4px; border: none; background: none; color: var(--wb-accent); }
.wb-btn--link:hover { background: none; text-decoration: underline; }
.wb-btn--danger.wb-btn--link { color: #dc2626; }
.wb-btn--sm { height: 28px; padding: 0 10px; font-size: 13px; }

/* ---- 输入 ---- */
.wb-input {
  width: 100%; padding: 8px 11px; font: 14px/1.5 var(--wb-font);
  color: var(--wb-text); background: var(--wb-surface);
  border: 1px solid var(--wb-border); border-radius: var(--wb-radius);
  transition: border-color .15s, box-shadow .15s; box-sizing: border-box;
}
.wb-input::placeholder { color: #a8a29e; }
.wb-input:focus { outline: none; border-color: var(--wb-accent); box-shadow: 0 0 0 3px var(--wb-accent-soft); }
textarea.wb-input { resize: vertical; min-height: 64px; }

/* ---- 表单字段 ---- */
.wb-field { margin-bottom: 16px; }
.wb-field__label { display: block; margin-bottom: 6px; font-size: 13.5px; font-weight: 500; color: var(--wb-text); }
.wb-field__req { color: #dc2626; margin-left: 2px; }
.wb-field__extra { margin-top: 4px; font-size: 12.5px; color: var(--wb-text-muted); }
.wb-field__error { margin-top: 4px; font-size: 12.5px; color: #dc2626; }

/* ---- 表格 ---- */
.wb-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.wb-table th { text-align: left; padding: 12px 14px; background: #faf8f5; color: var(--wb-text-muted); font-weight: 500; font-size: 13px; border-bottom: 1px solid var(--wb-border); white-space: nowrap; }
.wb-table td { padding: 12px 14px; border-bottom: 1px solid var(--wb-border-secondary, #f1efea); vertical-align: top; }
.wb-table tbody tr:hover { background: #fdfbf8; }
.wb-table--nested { background: #fdfcfa; }
.wb-table__expand { width: 36px; cursor: pointer; color: var(--wb-text-muted); user-select: none; }
.wb-table__wrap { overflow-x: auto; }

/* ---- Radix Dialog / AlertDialog ---- */
.wb-overlay { position: fixed; inset: 0; background: rgba(28,25,23,.42); animation: wb-fade .15s ease; z-index: 50; }
.wb-modal {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 92vw; max-width: 520px; max-height: 86vh; overflow: auto;
  background: var(--wb-surface); border-radius: 14px; padding: 20px 22px;
  box-shadow: 0 24px 60px -16px rgba(0,0,0,.3); z-index: 51; animation: wb-pop .15s ease;
}
.wb-modal__title { margin: 0 0 14px; font-size: 17px; font-weight: 600; color: var(--wb-text); }
.wb-modal__footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
@keyframes wb-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes wb-pop { from { opacity: 0; transform: translate(-50%,-48%) scale(.98) } to { opacity: 1; transform: translate(-50%,-50%) scale(1) } }

/* ---- Combobox (Radix Popover) ---- */
.wb-combo__trigger { width: 100%; text-align: left; }
.wb-combo__panel { width: var(--radix-popover-trigger-width); max-height: 280px; overflow: auto; background: var(--wb-surface); border: 1px solid var(--wb-border); border-radius: var(--wb-radius); box-shadow: var(--shadow, 0 10px 24px -8px rgba(0,0,0,.18)); padding: 6px; z-index: 60; }
.wb-combo__search { margin-bottom: 6px; }
.wb-combo__opt { padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; }
.wb-combo__opt:hover, .wb-combo__opt[data-active="true"] { background: var(--wb-accent-soft); color: var(--wb-accent-ink); }
.wb-combo__empty { padding: 10px; color: var(--wb-text-muted); font-size: 13px; text-align: center; }

/* ---- Dropzone ---- */
.wb-dropzone { display: block; padding: 28px 16px; text-align: center; border: 1.5px dashed var(--wb-border); border-radius: var(--wb-radius); background: #fdfcfa; cursor: pointer; transition: border-color .15s, background .15s; }
.wb-dropzone:hover, .wb-dropzone[data-drag="true"] { border-color: var(--wb-accent); background: var(--wb-accent-soft); }
.wb-dropzone__icon { font-size: 30px; color: var(--wb-accent); }
.wb-dropzone__text { margin: 8px 0 2px; color: var(--wb-text); }
.wb-dropzone__hint { font-size: 12.5px; color: var(--wb-text-muted); }

/* ---- Alert / Toast / Spinner / Skeleton / Empty ---- */
.wb-alert { padding: 10px 12px; border-radius: var(--wb-radius); background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 13.5px; margin-bottom: 12px; }
.wb-toast-viewport { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 80; width: 320px; max-width: 92vw; }
.wb-toast { padding: 12px 14px; border-radius: var(--wb-radius); background: var(--wb-surface); border: 1px solid var(--wb-border); box-shadow: 0 10px 24px -8px rgba(0,0,0,.18); font-size: 14px; animation: wb-pop .15s ease; }
.wb-toast--success { border-left: 3px solid #16a34a; }
.wb-toast--error { border-left: 3px solid #dc2626; }
.wb-spinner { width: 16px; height: 16px; border: 2px solid var(--wb-border); border-top-color: var(--wb-accent); border-radius: 50%; animation: wb-spin .7s linear infinite; display: inline-block; }
@keyframes wb-spin { to { transform: rotate(360deg) } }
.wb-skel { height: 16px; border-radius: 4px; background: linear-gradient(90deg,#f1efea 25%,#f7f5f1 50%,#f1efea 75%); background-size: 200% 100%; animation: wb-shimmer 1.3s infinite; }
@keyframes wb-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
.wb-empty { padding: 48px 16px; text-align: center; color: var(--wb-text-muted); }
```

- [ ] **Step 2: 验证**

Run: `npx tsc -b --noEmit`
Expected: No errors（CSS 不影响类型，主要确认未误改 ts）。

---

## Task 2: ui/Button

**Files:** Create `src/components/ui/Button.tsx`

- [ ] **Step 1: 实现**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'primary' | 'link'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  danger?: boolean
  small?: boolean
  icon?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'default', danger, small, icon, loading, children, className = '', disabled, ...rest }: Props) {
  const cls = [
    'wb-btn',
    variant === 'primary' && 'wb-btn--primary',
    variant === 'link' && 'wb-btn--link',
    danger && 'wb-btn--danger',
    small && 'wb-btn--sm',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="wb-spinner" /> : icon}
      {children}
    </button>
  )
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 3: ui/Spinner、Skeleton、Alert（小原子）

**Files:** Create `src/components/ui/Spinner.tsx`, `Skeleton.tsx`, `Alert.tsx`

- [ ] **Step 1: 实现**

```tsx
// Spinner.tsx
export function Spinner() { return <span className="wb-spinner" aria-label="加载中" /> }
```
```tsx
// Skeleton.tsx
export function Skeleton({ width = '100%' }: { width?: string | number }) {
  return <div className="wb-skel" style={{ width }} />
}
```
```tsx
// Alert.tsx
export function Alert({ message }: { message: string }) {
  return <div className="wb-alert" role="alert">{message}</div>
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 4: ui/toast（ToastProvider + useToast）

**Files:** Create `src/components/ui/toast.tsx`

- [ ] **Step 1: 实现**

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import * as Toast from '@radix-ui/react-toast'

type Kind = 'success' | 'error'
interface Item { id: number; kind: Kind; msg: string }
interface Api { success: (msg: string) => void; error: (msg: string) => void }

const Ctx = createContext<Api | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const push = useCallback((kind: Kind, msg: string) => {
    setItems(prev => [...prev, { id: prev.length ? prev[prev.length - 1].id + 1 : 1, kind, msg }])
  }, [])
  const api: Api = {
    success: msg => push('success', msg),
    error: msg => push('error', msg),
  }
  return (
    <Ctx.Provider value={api}>
      <Toast.Provider swipeDirection="right" duration={2600}>
        {children}
        {items.map(it => (
          <Toast.Root
            key={it.id}
            className={`wb-toast wb-toast--${it.kind}`}
            onOpenChange={open => { if (!open) setItems(prev => prev.filter(x => x.id !== it.id)) }}
          >
            <Toast.Description>{it.msg}</Toast.Description>
          </Toast.Root>
        ))}
        <Toast.Viewport className="wb-toast-viewport" />
      </Toast.Provider>
    </Ctx.Provider>
  )
}

export function useToast(): Api {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 5: ui/Modal（Radix Dialog）

**Files:** Create `src/components/ui/Modal.tsx`

- [ ] **Step 1: 实现**

```tsx
import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  footer?: ReactNode
  width?: number
  children: ReactNode
}

export function Modal({ open, onOpenChange, title, footer, width, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="wb-overlay" />
        <Dialog.Content className="wb-modal" style={width ? { maxWidth: width } : undefined}>
          <Dialog.Title className="wb-modal__title">{title}</Dialog.Title>
          {children}
          {footer && <div className="wb-modal__footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

注：Radix 要求有 `Dialog.Title`（无障碍）。若需描述可加 `Dialog.Description`，本应用用 title 足够。

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 6: ui/ConfirmButton（Radix AlertDialog，替代 Popconfirm）

**Files:** Create `src/components/ui/ConfirmButton.tsx`

- [ ] **Step 1: 实现**

```tsx
import type { ReactNode } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './Button'

interface Props {
  title: ReactNode
  onConfirm: () => void
  okText?: string
  cancelText?: string
  children: ReactNode  // 触发器（通常是“删除”链接按钮）
}

export function ConfirmButton({ title, onConfirm, okText = '确认', cancelText = '取消', children }: Props) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="wb-overlay" />
        <AlertDialog.Content className="wb-modal" style={{ maxWidth: 380 }}>
          <AlertDialog.Title className="wb-modal__title">{title}</AlertDialog.Title>
          <div className="wb-modal__footer">
            <AlertDialog.Cancel asChild><Button>{cancelText}</Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="primary" danger onClick={onConfirm}>{okText}</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
```

注：`Button danger variant="primary"` 在删除场景需要一个实心红。Task 1 的 `.wb-btn--danger` 目前只覆盖 link 形态——**在 Task 1 的 CSS 里补一条**：`.wb-btn--primary.wb-btn--danger { background:#dc2626; border-color:#dc2626 } .wb-btn--primary.wb-btn--danger:hover { background:#b91c1c; border-color:#b91c1c }`。

- [ ] **Step 2: 回填 Task 1 CSS**（上面那条实心红规则），再 `npx tsc -b --noEmit` → No errors。

---

## Task 7: ui/Field

**Files:** Create `src/components/ui/Field.tsx`

- [ ] **Step 1: 实现**

```tsx
import type { ReactNode } from 'react'

interface Props {
  label: ReactNode
  required?: boolean
  error?: string
  extra?: ReactNode
  children: ReactNode
}

export function Field({ label, required, error, extra, children }: Props) {
  return (
    <div className="wb-field">
      <label className="wb-field__label">
        {label}{required && <span className="wb-field__req">*</span>}
      </label>
      {children}
      {extra && !error && <div className="wb-field__extra">{extra}</div>}
      {error && <div className="wb-field__error">{error}</div>}
    </div>
  )
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 8: ui/Combobox（Radix Popover + 过滤）

**Files:** Create `src/components/ui/Combobox.tsx`

- [ ] **Step 1: 实现**

```tsx
import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'

interface Option { label: string; value: string }
interface Props {
  value?: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
}

export function Combobox({ value, onChange, options, placeholder = '请选择', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = options.find(o => o.value === value)
  const filtered = useMemo(
    () => options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q]
  )
  return (
    <Popover.Root open={open} onOpenChange={o => { setOpen(o); if (!o) setQ('') }}>
      <Popover.Trigger asChild disabled={disabled}>
        <button type="button" className="wb-input wb-combo__trigger" disabled={disabled}>
          {selected ? selected.label : <span style={{ color: '#a8a29e' }}>{placeholder}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="wb-combo__panel" align="start" sideOffset={4}>
          <input
            className="wb-input wb-combo__search"
            placeholder="搜索…"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
          {filtered.length === 0 && <div className="wb-combo__empty">无匹配</div>}
          {filtered.map(o => (
            <div
              key={o.value}
              className="wb-combo__opt"
              data-active={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); setQ('') }}
            >
              {o.label}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 9: ui/FileDropzone

**Files:** Create `src/components/ui/FileDropzone.tsx`

- [ ] **Step 1: 实现**

```tsx
import { useRef, useState } from 'react'
import { Tray } from '@phosphor-icons/react'

interface Props {
  accept?: string
  onFile: (file: File) => void
  hint?: string
}

export function FileDropzone({ accept = '.txt', onFile, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return (
    <div
      className="wb-dropzone"
      data-drag={drag}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <div className="wb-dropzone__icon"><Tray /></div>
      <p className="wb-dropzone__text">点击或拖拽 txt 文件到此区域</p>
      {hint && <p className="wb-dropzone__hint">{hint}</p>}
      <input
        ref={inputRef} type="file" accept={accept} hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 10: ui/icons

**Files:** Create `src/components/ui/icons.ts`

- [ ] **Step 1: 实现**

```ts
export { BookOpen, Plus, UploadSimple, Tray } from '@phosphor-icons/react'
```

统一在用处设 `weight="bold"` 或在此用 IconContext 锁 weight。本应用直接在组件内传 `weight="bold"`。

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 11: 改写 SentenceModal

**Files:** Modify `src/components/SentenceModal.tsx`（整文件替换）

- [ ] **Step 1: 用 ui 组件重写**（保留 props 接口与“创建下一个”逻辑）

```tsx
import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Combobox } from './ui/Combobox'
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

  return (
    <Modal
      open={open}
      onOpenChange={o => { if (!o) onCancel() }}
      title={isEditing ? '编辑句子' : '新建句子'}
      footer={
        <>
          <Button onClick={onCancel}>取消</Button>
          {!isEditing && <Button onClick={() => submit(true)}>创建下一个</Button>}
          <Button variant="primary" onClick={() => submit(false)}>保存</Button>
        </>
      }
    >
      <Field label="所属文章" required error={errors.articleId}>
        <Combobox
          value={articleId}
          onChange={v => setArticleId(v)}
          options={articles.map(a => ({ label: a.title, value: a.id }))}
          placeholder="选择文章"
          disabled={isEditing}
        />
      </Field>
      <Field label="句子内容" required error={errors.content} extra="括号格式：I have a (pen-笔)">
        <textarea className="wb-input" rows={3} placeholder="I have a (pen-笔)" value={content} onChange={e => setContent(e.target.value)} />
      </Field>
      <Field label="中文翻译">
        <textarea className="wb-input" rows={2} placeholder="我有一支笔" value={translate} onChange={e => setTranslate(e.target.value)} />
      </Field>
    </Modal>
  )
}
```

注：父级 App 通过 `key={modalKey}` 强制重挂以实现“创建下一个”——本组件用 `useEffect([open,...])` 重置即可，保留 key 行为也兼容。

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 12: 改写 BatchUploadModal

**Files:** Modify `src/components/BatchUploadModal.tsx`（整文件替换；保留 `parseTxt` 不变）

- [ ] **Step 1: 用 ui 组件重写**

```tsx
import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Combobox } from './ui/Combobox'
import { FileDropzone } from './ui/FileDropzone'
import { Alert } from './ui/Alert'
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

  return (
    <Modal
      open={open}
      onOpenChange={o => { if (!o) handleCancel() }}
      title="批量上传句子"
      width={700}
      footer={
        <>
          <Button onClick={handleCancel}>取消</Button>
          <Button variant="primary" disabled={!articleId || rows.length === 0} loading={submitting} onClick={handleOk}>
            上传 {rows.length > 0 ? `(${rows.length} 条)` : ''}
          </Button>
        </>
      }
    >
      <Field label="所属文章" required>
        <Combobox value={articleId} onChange={setArticleId} options={articles.map(a => ({ label: a.title, value: a.id }))} placeholder="选择文章" />
      </Field>
      <Field label="上传 txt 文件" extra="格式：句子内容（第1行）+ 翻译（第2行）+ 空行分隔">
        <FileDropzone accept=".txt" onFile={handleFile} hint="每条句子占两行：第1行内容，第2行翻译，句子之间用空行分隔" />
      </Field>
      {parseError && <Alert message={parseError} />}
      {rows.length > 0 && (
        <Field label={`预览（共 ${rows.length} 条）`}>
          <div className="wb-table__wrap" style={{ maxHeight: 220, overflow: 'auto' }}>
            <table className="wb-table">
              <thead><tr><th>句子内容</th><th style={{ width: 200 }}>中文翻译</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}><td>{r.content}</td><td>{r.translate}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Field>
      )}
    </Modal>
  )
}
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 13: 改写 App.tsx

**Files:** Modify `src/App.tsx`（整文件替换）

- [ ] **Step 1: 用原生表格 + ui 组件重写**（保留全部状态与处理函数；`renderContent` 的 `.wb-chip` 不变；`message.*` → `useToast()`）

关键改动：
- `import { useToast } from './ui/toast'`，组件内 `const toast = useToast()`，把所有 `message.success/error` 改为 `toast.success/error`。
- 文章表与嵌套句子表改为原生 `<table className="wb-table">`，外层包 `.wb-panel` + `.wb-table__wrap`。
- 展开：第一列放 `.wb-table__expand` 的 `＋/－`，点击走现有 `handleExpand`；展开时在该 `<tr>` 下插入一行 `<tr><td colSpan={2}>` 内嵌句子表（loading 时显示 `<Spinner/>`，空时 `.wb-empty`）。
- header / toolbar 结构与类名沿用现有（`.wb-header/.wb-logo/.wb-title/.wb-subtitle/.wb-count/.wb-toolbar`），图标换 Phosphor：`<BookOpen weight="bold"/>`、`<Plus/>`、`<UploadSimple/>`。
- 删除确认：用 `<ConfirmButton title=... onConfirm=...><Button variant="link" danger small>删除</Button></ConfirmButton>`。
- 文章列表加载用骨架：`articlesLoading` 时渲染 3 行 `<Skeleton/>`。
- 去掉分页：直接 `articles.map(...)`。

完整文件在实现时产出（结构等价于现有 App.tsx，仅替换组件层）。

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 14: 改写 main.tsx

**Files:** Modify `src/main.tsx`

- [ ] **Step 1: 去 ConfigProvider，包 ToastProvider**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider } from './components/ui/toast'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
```

- [ ] **Step 2: 验证** `npx tsc -b --noEmit` → No errors。

---

## Task 15: 清理依赖 + 全面验证

**Files:** Modify `package.json`

- [ ] **Step 1: 确认 src 无 antd 引用**

Run: `grep -rn "antd\|@ant-design" src/`
Expected: 零命中。若有残留，先修。

- [ ] **Step 2: 卸载 antd**

```bash
npm uninstall antd @ant-design/icons
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `npx tsc -b --noEmit && npm run build`
Expected: No errors；build 成功；bundle 较此前显著变小。

- [ ] **Step 4: 浏览器验证**（preview_start dev → 截图）

逐项确认：header / 工具栏 / 文章表 / 展开句子（chip 琥珀）/ 新建文章弹窗 / 新建句子弹窗（Combobox 搜索）/ 批量上传（拖拽 + 预览表）/ toast 提示 / 删除确认弹窗。桌面 + 移动端各一张截图。

- [ ] **Step 5: 提交**（**等用户批准 git 操作**）

```bash
git add -A
git commit -m "refactor: 用原生 + Radix 重建 UI，移除 Ant Design"
```

---

## 自审（spec 覆盖核对）

- 映射表每个 antd 组件都有对应 Task：Button(2)/Spinner-Skeleton-Alert(3)/toast(4)/Modal(5)/ConfirmButton(6)/Field(7)/Combobox(8)/FileDropzone(9)/icons(10)；消费方 SentenceModal(11)/BatchUpload(12)/App(13)/main(14)；清理(15)。✅
- 可搜索 Select = Combobox（Radix Popover）✅
- 校验、loading/empty/error、主题锁定均落到具体 Task ✅
- 类型一致：`useToast()` 接口 `success/error` 在 toast.tsx 定义、App 使用一致；`Combobox` props 在 11/12 使用一致。✅
- 占位符：Task 13 的 App 全量代码标注“实现时产出”——因其与现有文件结构等价、仅替换组件层，关键改动已逐条列出，非模糊占位。
