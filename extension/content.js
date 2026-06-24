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

  // ===== 捕获：选中网页句子 → 存入 WordBread =====
  var captureBtn = null
  var captureHost = null // shadow DOM 宿主
  var wbSelTimer = null

  function removeCaptureBtn() {
    if (captureBtn) { captureBtn.remove(); captureBtn = null }
  }

  function onSelectionChange() {
    var sel = window.getSelection()
    var text = sel && sel.toString().trim()
    if (!text || text.length < 6 || text.length > 400 || !/[a-zA-Z]/.test(text)) {
      removeCaptureBtn(); return
    }
    if (captureHost) return // 弹窗开着时不重复弹按钮
    showCaptureBtn(sel)
  }

  function showCaptureBtn(sel) {
    removeCaptureBtn()
    var range = sel.getRangeAt(0)
    var rect = range.getBoundingClientRect()
    captureBtn = document.createElement('button')
    captureBtn.textContent = '＋ 存入 WordBread'
    captureBtn.className = 'wb-capture-btn'
    captureBtn.style.cssText =
      'position:absolute;z-index:2147483646;font:600 12px/1 system-ui,sans-serif;' +
      'background:#d97706;color:#fff;border:none;border-radius:6px;padding:6px 10px;' +
      'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);'
    captureBtn.style.top = (rect.bottom + window.scrollY + 6) + 'px'
    captureBtn.style.left = (rect.left + window.scrollX) + 'px'
    var captured = sel.toString().trim()
    captureBtn.addEventListener('mousedown', function (e) { e.preventDefault() }) // 防止点击时丢失选区
    captureBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation()
      removeCaptureBtn()
      openCapturePanel(captured)
    })
    document.body.appendChild(captureBtn)
  }

  function closeCapturePanel() {
    if (captureHost) { captureHost.remove(); captureHost = null }
  }

  function openCapturePanel(text) {
    closeCapturePanel()
    captureHost = document.createElement('div')
    captureHost.style.cssText = 'position:fixed;z-index:2147483647;inset:0;'
    var shadow = captureHost.attachShadow({ mode: 'open' })
    var annotated = (typeof buildAnnotatedContent === 'function')
      ? buildAnnotatedContent(text, wordMap) : text
    shadow.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '.mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}' +
      '.card{background:#fff;color:#1a1a1a;width:min(560px,92vw);border-radius:14px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.3)}' +
      '.card h3{margin:0 0 10px;font-size:15px}' +
      '.lbl{font-size:12px;color:#666;margin:10px 0 4px}' +
      'textarea,select{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:8px;font:13px/1.6 system-ui;color:#1a1a1a;background:#fff}' +
      'textarea{resize:vertical}' +
      '.hint{font-size:11px;color:#999;margin-top:4px}' +
      '.row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}' +
      'button{font:600 13px system-ui;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid #ddd;background:#fff}' +
      '.save{background:#d97706;color:#fff;border-color:#d97706}' +
      '.err{color:#dc2626;font-size:12px;margin-top:8px;min-height:14px}' +
      '</style>' +
      '<div class="mask">' +
      '<div class="card">' +
      '<h3>存入 WordBread</h3>' +
      '<div class="lbl">句子（已自动标注你学过的词，可改：用 (word-中文) 标记要挖空的生词）</div>' +
      '<textarea id="wb-content" rows="3"></textarea>' +
      '<div class="hint">至少标注一个 (词-中文) 才能用于练习。</div>' +
      '<div class="lbl">中文翻译（可选）</div>' +
      '<textarea id="wb-translate" rows="2"></textarea>' +
      '<div class="lbl">存到文章</div>' +
      '<select id="wb-article"><option value="">网页收藏（默认）</option></select>' +
      '<div class="err" id="wb-err"></div>' +
      '<div class="row">' +
      '<button id="wb-cancel">取消</button>' +
      '<button class="save" id="wb-save">存入</button>' +
      '</div></div></div>'
    document.body.appendChild(captureHost)

    var $ = function (id) { return shadow.getElementById(id) }
    $('wb-content').value = annotated
    $('wb-cancel').addEventListener('click', closeCapturePanel)
    shadow.querySelector('.mask').addEventListener('click', function (e) {
      if (e.target.classList.contains('mask')) closeCapturePanel()
    })

    // 拉文章列表填充下拉
    chrome.runtime.sendMessage({ type: 'wb-articles' }, function (resp) {
      if (resp && resp.ok && Array.isArray(resp.articles)) {
        resp.articles.forEach(function (a) {
          var opt = document.createElement('option')
          opt.value = a.id; opt.textContent = a.title
          $('wb-article').appendChild(opt)
        })
      }
    })

    $('wb-save').addEventListener('click', function () {
      var content = $('wb-content').value.trim()
      var translate = $('wb-translate').value.trim()
      var articleId = $('wb-article').value
      if (!/\([^)]+\)/.test(content)) {
        $('wb-err').textContent = '请至少用 (词-中文) 标注一个生词'
        return
      }
      $('wb-save').disabled = true
      $('wb-save').textContent = '存入中…'
      $('wb-err').textContent = ''
      chrome.runtime.sendMessage(
        { type: 'wb-save', payload: { content: content, translate: translate, articleId: articleId } },
        function (resp) {
          if (resp && resp.ok) {
            closeCapturePanel()
          } else {
            $('wb-save').disabled = false
            $('wb-save').textContent = '存入'
            $('wb-err').textContent = '存入失败：' + ((resp && resp.error) || '未知错误')
          }
        }
      )
    })
  }

  document.addEventListener('selectionchange', function () {
    clearTimeout(wbSelTimer)
    wbSelTimer = setTimeout(onSelectionChange, 250)
  })
  document.addEventListener('mousedown', function (e) {
    if (captureBtn && e.target !== captureBtn) removeCaptureBtn()
  }, true)

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
