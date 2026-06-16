// 解析句子里的 (英文-中文) 标注，供练习页（cloze）与高亮复用。
// content 例："I have a (pen-笔)" / "China's (trade surplus-贸易顺差) (top-超过) $1 trillion"

const CJK = /[一-鿿㐀-䶿]/

export type Segment =
  | { type: 'text'; value: string }
  | { type: 'blank'; answer: string; hint: string }

/**
 * 拆 "英文-中文"：
 * 优先按首个 CJK 字符切（兼容英文里的连字符，如 ice-cream），
 * 回退到最后一个 '-'，再回退到整串当 answer、无 hint。
 */
export function splitAnnotation(inner: string): { answer: string; hint: string } {
  const s = inner.trim()
  const i = s.search(CJK)
  if (i > 0) {
    const answer = s.slice(0, i).replace(/-\s*$/, '').trim()
    const hint = s.slice(i).trim()
    if (answer && hint) return { answer, hint }
  }
  const d = s.lastIndexOf('-')
  if (d > 0) return { answer: s.slice(0, d).trim(), hint: s.slice(d + 1).trim() }
  return { answer: s, hint: '' }
}

/** 把 content 拆成 文本段 / 空格段 的有序数组 */
export function parseContent(content: string): Segment[] {
  return content
    .split(/(\([^)]+\))/g)
    .filter(Boolean)
    .map((p): Segment =>
      /^\([^)]+\)$/.test(p)
        ? { type: 'blank', ...splitAnnotation(p.slice(1, -1)) }
        : { type: 'text', value: p }
    )
}

/** 句子是否含可挖空的标注 */
export const hasBlanks = (content: string): boolean => /\([^)]+\)/.test(content)

/** 判定用归一化：去首尾空格 + 小写 + 内部空格压成单个 */
export const normalizeAnswer = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, ' ')

/** 拼出可朗读的纯英文句子：文本段原样 + 每个标注取英文 answer，去掉中文与括号 */
export const toPlainSentence = (content: string): string =>
  parseContent(content)
    .map(s => (s.type === 'text' ? s.value : s.answer))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
