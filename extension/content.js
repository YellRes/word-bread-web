// 在网页中高亮用户的重点词；点击高亮词弹出中文释义。
(function () {
  if (window.__wbHighlighterLoaded) return
  window.__wbHighlighterLoaded = true

  var wordMap = {}
  var regex = null
  var enabled = true
  var blacklist = []
  var processed = new WeakSet()
  var observer = null
  var debounceTimer = null

  // 黑名单：默认全站高亮，名单里的站点（含其子域）不高亮。空名单 = 全站高亮。
  function siteBlocked() {
    if (!blacklist || blacklist.length === 0) return false
    var h = location.hostname
    return blacklist.some(function (d) { return h === d || h.endsWith('.' + d) })
  }
  function active() { return enabled && !siteBlocked() }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1 }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function buildRegex(map) {
    var keys = Object.keys(map)
    if (keys.length === 0) return null
    // 长短语优先：按长度降序；空格放宽成 \s+，容忍换行/多空格
    keys.sort(function (a, b) { return b.length - a.length })
    var alts = keys.map(function (k) {
      return escapeRegExp(k).replace(/\s+/g, '\\s+')
    })
    return new RegExp('\\b(?:' + alts.join('|') + ')\\b', 'gi')
  }

  function shouldSkip(node) {
    var p = node.parentNode
    while (p && p.nodeType === 1) {
      if (SKIP_TAGS[p.tagName]) return true
      if (p.isContentEditable) return true
      if (p.classList && p.classList.contains('wb-hl')) return true
      p = p.parentNode
    }
    return false
  }

  function processTextNode(node) {
    var text = node.nodeValue
    if (!text || !text.trim()) return
    regex.lastIndex = 0
    if (!regex.test(text)) return
    regex.lastIndex = 0

    var frag = document.createDocumentFragment()
    var last = 0
    var m
    while ((m = regex.exec(text))) {
      var start = m.index
      var end = start + m[0].length
      if (end === start) { regex.lastIndex++; continue }
      if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)))
      var mark = document.createElement('mark')
      mark.className = 'wb-hl'
      var norm = m[0].toLowerCase().replace(/\s+/g, ' ')
      var entry = wordMap[norm]
      mark.dataset.hint = entry ? entry.hint || '' : ''
      mark.textContent = m[0]
      frag.appendChild(mark)
      last = end
    }
    if (last === 0) return
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
    if (node.parentNode) node.parentNode.replaceChild(frag, node)
  }

  function scan(root) {
    if (!regex || !active()) return
    if (root.nodeType === 3) { if (!shouldSkip(root)) processTextNode(root); return }
    if (root.nodeType !== 1 && root.nodeType !== 9) return
    if (root.nodeType === 1 && processed.has(root)) return

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        if (shouldSkip(n)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    var nodes = []
    var cur
    while ((cur = walker.nextNode())) nodes.push(cur)
    nodes.forEach(processTextNode)
    if (root.nodeType === 1) processed.add(root)
  }

  function removeAllHighlights() {
    var marks = document.querySelectorAll('mark.wb-hl')
    marks.forEach(function (mk) {
      var t = document.createTextNode(mk.textContent)
      var parent = mk.parentNode
      if (parent) { parent.replaceChild(t, mk); parent.normalize() }
    })
    closePopover()
  }

  function startObserver() {
    if (observer) return
    observer = new MutationObserver(function (mutations) {
      if (!active() || !regex) return
      var added = []
      mutations.forEach(function (mu) {
        mu.addedNodes && mu.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 || n.nodeType === 3) added.push(n)
        })
      })
      if (added.length === 0) return
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(function () {
        added.forEach(function (n) {
          if (n.isConnected) scan(n)
        })
      }, 300)
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ---- 点击释义浮层 ----
  var popover = null
  function closePopover() {
    if (popover) { popover.remove(); popover = null }
  }
  function showPopover(mark) {
    closePopover()
    var hint = mark.dataset.hint
    popover = document.createElement('div')
    popover.className = 'wb-popover'
    var word = document.createElement('div')
    word.className = 'wb-popover-word'
    word.textContent = mark.textContent
    popover.appendChild(word)
    var hintEl = document.createElement('div')
    if (hint) { hintEl.className = 'wb-popover-hint'; hintEl.textContent = hint }
    else { hintEl.className = 'wb-popover-empty'; hintEl.textContent = '（无释义）' }
    popover.appendChild(hintEl)
    document.body.appendChild(popover)

    var r = mark.getBoundingClientRect()
    var top = r.bottom + window.scrollY + 6
    var left = r.left + window.scrollX
    // 防溢出右边
    var maxLeft = window.scrollX + document.documentElement.clientWidth - popover.offsetWidth - 8
    if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft)
    popover.style.top = top + 'px'
    popover.style.left = left + 'px'
  }

  document.addEventListener('click', function (e) {
    var mark = e.target.closest && e.target.closest('mark.wb-hl')
    if (mark) {
      e.preventDefault()
      e.stopPropagation()
      showPopover(mark)
    } else if (popover && !popover.contains(e.target)) {
      closePopover()
    }
  }, true)
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopover() })
  window.addEventListener('scroll', closePopover, { passive: true })

  // ---- 初始化 / 状态联动 ----
  function applyState() {
    if (active() && regex && document.body) {
      processed = new WeakSet()
      scan(document.body)
      startObserver()
    } else {
      removeAllHighlights()
    }
  }

  function init() {
    chrome.storage.local.get(['wordMap', 'enabled', 'blacklist'], function (data) {
      wordMap = data.wordMap || {}
      enabled = data.enabled !== false
      blacklist = data.blacklist || []
      regex = buildRegex(wordMap)
      applyState()
    })
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return
    if (changes.enabled) enabled = changes.enabled.newValue !== false
    if (changes.blacklist) blacklist = changes.blacklist.newValue || []
    if (changes.wordMap) {
      wordMap = changes.wordMap.newValue || {}
      regex = buildRegex(wordMap)
    }
    if (changes.enabled || changes.blacklist || changes.wordMap) applyState()
  })

  chrome.runtime.onMessage.addListener(function (msg, _s, sendResponse) {
    if (msg && msg.type === 'wb-stats') {
      sendResponse({ hits: document.querySelectorAll('mark.wb-hl').length })
    }
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
