// 从网页端 src/lib/annotation.ts 移植的纯 JS 版，口径保持一致。
// content 例："I have a (pen-笔)" / "China's (trade surplus-贸易顺差) (top-超过) $1 trillion"

var WB_CJK = /[一-鿿㐀-䶿]/

/**
 * 拆 "英文-中文"：优先按首个 CJK 字符切（兼容英文里的连字符，如 ice-cream），
 * 回退到最后一个 '-'，再回退到整串当 answer、无 hint。
 */
function wbSplitAnnotation(inner) {
  var s = inner.trim()
  var i = s.search(WB_CJK)
  if (i > 0) {
    var answer = s.slice(0, i).replace(/-\s*$/, '').trim()
    var hint = s.slice(i).trim()
    if (answer && hint) return { answer: answer, hint: hint }
  }
  var d = s.lastIndexOf('-')
  if (d > 0) return { answer: s.slice(0, d).trim(), hint: s.slice(d + 1).trim() }
  return { answer: s, hint: '' }
}

/** 提取一条 content 里所有 (英文-中文) 标注 → [{answer, hint}] */
function extractAnnotations(content) {
  if (!content) return []
  var out = []
  var re = /\(([^)]+)\)/g
  var m
  while ((m = re.exec(content))) {
    var parsed = wbSplitAnnotation(m[1])
    if (parsed.answer) out.push(parsed)
  }
  return out
}

// 暴露给 service worker / content script 全局
if (typeof self !== 'undefined') {
  self.extractAnnotations = extractAnnotations
  self.wbSplitAnnotation = wbSplitAnnotation
}
