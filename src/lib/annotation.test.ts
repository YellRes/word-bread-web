import { describe, it, expect } from 'vitest'
import { splitAnnotation, parseContent, hasBlanks, normalizeAnswer, toPlainSentence } from './annotation'

describe('splitAnnotation', () => {
  it('按首个中文字符切分英文/中文', () => {
    expect(splitAnnotation('pen-笔')).toEqual({ answer: 'pen', hint: '笔' })
  })
  it('多词答案保留空格', () => {
    expect(splitAnnotation('trade surplus-贸易顺差')).toEqual({ answer: 'trade surplus', hint: '贸易顺差' })
  })
  it('英文连字符不被误切（无中文时回退到最后一个 -）', () => {
    expect(splitAnnotation('ice-cream')).toEqual({ answer: 'ice', hint: 'cream' })
  })
  it('无分隔时整串作答案、无释义', () => {
    expect(splitAnnotation('hello')).toEqual({ answer: 'hello', hint: '' })
  })
})

describe('parseContent', () => {
  it('拆成 文本段 / 空格段', () => {
    const segs = parseContent('I have a (pen-笔)')
    expect(segs).toEqual([
      { type: 'text', value: 'I have a ' },
      { type: 'blank', answer: 'pen', hint: '笔' },
    ])
  })
})

describe('hasBlanks', () => {
  it('含括号标注返回 true', () => {
    expect(hasBlanks('a (pen-笔)')).toBe(true)
  })
  it('无标注返回 false', () => {
    expect(hasBlanks('a pen')).toBe(false)
  })
})

describe('normalizeAnswer', () => {
  it('去首尾空格 + 小写 + 压内部空格', () => {
    expect(normalizeAnswer('  Trade   Surplus ')).toBe('trade surplus')
  })
})

describe('toPlainSentence', () => {
  it('拼出纯英文句子（去中文与括号）', () => {
    expect(toPlainSentence('I have a (pen-笔).')).toBe('I have a pen.')
  })
})
