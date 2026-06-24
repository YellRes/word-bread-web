// Service worker：从 Supabase 拉句子 → 提取重点词 → 缓存到 storage。
importScripts('config.js', 'lib/annotation.js')

const REFRESH_ALARM = 'wb-refresh'

/** 拉取并重建词表，写入 chrome.storage.local。返回词数；失败返回 -1（沿用旧缓存）。 */
async function refreshWordMap() {
  try {
    const res = await fetch(`${WB_CONFIG.url}/rest/v1/Sentence?select=content`, {
      headers: {
        apikey: WB_CONFIG.key,
        Authorization: `Bearer ${WB_CONFIG.key}`,
      },
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const rows = await res.json()

    const wordMap = {}
    for (const r of rows) {
      if (!r || !r.content) continue
      for (const { answer, hint } of extractAnnotations(r.content)) {
        const key = answer.trim().toLowerCase().replace(/\s+/g, ' ')
        if (!key) continue
        if (!wordMap[key]) wordMap[key] = { display: answer.trim(), hint: hint || '' }
        else if (!wordMap[key].hint && hint) wordMap[key].hint = hint
      }
    }

    const count = Object.keys(wordMap).length
    await chrome.storage.local.set({ wordMap, count, updatedAt: Date.now() })
    console.log('[WordBread] 词表已更新：', count, '个词')
    return count
  } catch (e) {
    console.error('[WordBread] 拉取词表失败：', e)
    return -1
  }
}

function wbHeaders(extra) {
  return Object.assign({
    apikey: WB_CONFIG.key,
    Authorization: `Bearer ${WB_CONFIG.key}`,
  }, extra || {})
}

/** 拉文章列表 [{id,title}]，按创建时间倒序。 */
async function fetchArticlesRest() {
  const res = await fetch(`${WB_CONFIG.url}/rest/v1/Article?select=id,title&order=createdAt.desc`, {
    headers: wbHeaders(),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/** 确保"网页收藏"文章存在，返回其 id。 */
async function ensureInboxArticle() {
  const title = '网页收藏'
  const q = await fetch(
    `${WB_CONFIG.url}/rest/v1/Article?select=id&title=eq.${encodeURIComponent(title)}&limit=1`,
    { headers: wbHeaders() }
  )
  if (q.ok) {
    const rows = await q.json()
    if (rows && rows[0]) return rows[0].id
  }
  const id = crypto.randomUUID()
  const ins = await fetch(`${WB_CONFIG.url}/rest/v1/Article`, {
    method: 'POST',
    headers: wbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id, title }),
  })
  if (!ins.ok) throw new Error('create inbox HTTP ' + ins.status)
  return id
}

/** 写入一条句子。articleId 为空时存入"网页收藏"。 */
async function saveSentenceRest({ content, translate, articleId }) {
  const finalArticleId = articleId || (await ensureInboxArticle())
  const res = await fetch(`${WB_CONFIG.url}/rest/v1/Sentence`, {
    method: 'POST',
    headers: wbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: crypto.randomUUID(),
      content,
      articleId: finalArticleId,
      translate: translate || '',
    }),
  })
  if (!res.ok) throw new Error('save HTTP ' + res.status)
  return true
}

chrome.runtime.onInstalled.addListener(async () => {
  // 默认开启
  const { enabled } = await chrome.storage.local.get('enabled')
  if (enabled === undefined) await chrome.storage.local.set({ enabled: true })
  refreshWordMap()
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 360 })
})

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => refreshWordMap())
}

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === REFRESH_ALARM) refreshWordMap()
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'wb-refresh') {
    refreshWordMap().then(count => sendResponse({ count }))
    return true // 异步响应
  }
  if (msg && msg.type === 'wb-articles') {
    fetchArticlesRest()
      .then(articles => sendResponse({ ok: true, articles }))
      .catch(e => { console.error('[WordBread] 拉文章失败', e); sendResponse({ ok: false, error: String(e) }) })
    return true
  }
  if (msg && msg.type === 'wb-save') {
    saveSentenceRest(msg.payload || {})
      .then(() => { refreshWordMap(); sendResponse({ ok: true }) }) // 存完顺手刷新词表
      .catch(e => { console.error('[WordBread] 存句失败', e); sendResponse({ ok: false, error: String(e) }) })
    return true
  }
})
