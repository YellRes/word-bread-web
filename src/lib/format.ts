/** 把 ISO 时间戳格式化为本地「YYYY-MM-DD HH:mm」；空值返回占位符。 */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 把 ISO 时间戳格式化为「YYYY 年 M 月」分组标题；空值归为「未知日期」。 */
export function formatMonth(iso?: string): string {
  if (!iso) return '未知日期'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '未知日期'
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

/** 把「下次复习时间」格式化为相对标签：已到期 / 今天 / 明天 / N 天后。 */
export function formatDue(iso?: string): string {
  if (!iso) return '—'
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return '—'
  // 按「自然日」差计算，避免时分造成的误差
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000)
  if (diffDays <= 0) return '已到期'
  if (diffDays === 1) return '明天'
  return `${diffDays} 天后`
}
