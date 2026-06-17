import { toast } from 'sonner'

/** 用 Web Speech API 朗读英文文本；打断上一段，避免叠音。 */
export function speak(text: string, rate = 0.95) {
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
