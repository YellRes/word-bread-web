const toggle = document.getElementById('toggle')
const siteEl = document.getElementById('site')
const siteBtn = document.getElementById('siteBtn')
const listEl = document.getElementById('list')
const countEl = document.getElementById('count')
const hitsEl = document.getElementById('hits')
const refreshBtn = document.getElementById('refresh')

let blacklist = []
let currentHost = ''

function setBlacklist(next) {
  blacklist = next
  chrome.storage.local.set({ blacklist: next }, render)
}

function render() {
  // 当前站点按钮：在黑名单里 → 「在本站启用」（移除）；否则 →「在本站禁用」（加入）
  if (!currentHost) {
    siteEl.textContent = '当前页面不可设置'
    siteBtn.disabled = true
  } else {
    siteEl.textContent = currentHost
    siteBtn.disabled = false
    const blocked = blacklist.includes(currentHost)
    siteBtn.textContent = blocked ? '在本站启用' : '在本站禁用'
    siteBtn.classList.toggle('btn-remove', !blocked)
  }

  // 黑名单列表
  listEl.innerHTML = ''
  if (blacklist.length === 0) {
    const e = document.createElement('div')
    e.className = 'empty'
    e.textContent = '黑名单为空 — 高亮在所有站点生效'
    listEl.appendChild(e)
  } else {
    blacklist.forEach(d => {
      const item = document.createElement('div')
      item.className = 'item'
      const name = document.createElement('span')
      name.textContent = d
      const x = document.createElement('span')
      x.className = 'x'
      x.textContent = '×'
      x.title = '移除'
      x.addEventListener('click', () => setBlacklist(blacklist.filter(w => w !== d)))
      item.appendChild(name)
      item.appendChild(x)
      listEl.appendChild(item)
    })
  }
}

siteBtn.addEventListener('click', () => {
  if (!currentHost) return
  if (blacklist.includes(currentHost)) setBlacklist(blacklist.filter(w => w !== currentHost))
  else setBlacklist(blacklist.concat(currentHost))
})

// 初始化
chrome.storage.local.get(['count', 'enabled', 'blacklist'], data => {
  countEl.textContent = data.count != null ? String(data.count) : '0'
  toggle.checked = data.enabled !== false
  blacklist = data.blacklist || []
  render()
})

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked })
})

// 当前标签域名 + 本页命中
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs[0]
  try {
    if (tab && tab.url && /^https?:/.test(tab.url)) currentHost = new URL(tab.url).hostname
  } catch (_) { currentHost = '' }
  render()

  if (!tab || !tab.id) { hitsEl.textContent = '—'; return }
  chrome.tabs.sendMessage(tab.id, { type: 'wb-stats' }, resp => {
    if (chrome.runtime.lastError || !resp) { hitsEl.textContent = '—'; return }
    hitsEl.textContent = String(resp.hits)
  })
})

refreshBtn.addEventListener('click', () => {
  refreshBtn.disabled = true
  refreshBtn.textContent = '刷新中…'
  chrome.runtime.sendMessage({ type: 'wb-refresh' }, resp => {
    const n = resp && typeof resp.count === 'number' ? resp.count : -1
    if (n >= 0) { countEl.textContent = String(n); refreshBtn.textContent = '已更新' }
    else refreshBtn.textContent = '刷新失败'
    setTimeout(() => { refreshBtn.disabled = false; refreshBtn.textContent = '刷新词表' }, 1200)
  })
})
