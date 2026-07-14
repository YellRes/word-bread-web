import { toast } from 'sonner'

const RATE_KEY = 'wb_speech_rate'

/** 朗读语速预设（rate 越小越慢），区间 0.6–1。0.8 为默认档。 */
export const SPEECH_RATES = [
  { value: 0.6, label: '0.6×' },
  { value: 0.7, label: '0.7×' },
  { value: 0.8, label: '0.8×' },
  { value: 0.9, label: '0.9×' },
  { value: 1, label: '1×' },
] as const

export const DEFAULT_RATE = 0.8

/** 读取用户设置的朗读语速；无/非法时回退默认。 */
export function getSpeechRate(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_RATE
  const v = Number(localStorage.getItem(RATE_KEY))
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RATE
}

/** 持久化朗读语速。 */
export function setSpeechRate(rate: number) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(RATE_KEY, String(rate))
}

/** 用 Web Speech API 朗读英文文本；打断上一段，避免叠音。rate 省略时用用户设置的语速。 */
export function speak(text: string, rate: number = getSpeechRate()) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    toast.error('当前浏览器不支持语音播放')
    return
  }
  if (!text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  window.speechSynthesis.speak(u)
}
