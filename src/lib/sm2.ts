// 标准 SM-2 间隔重复算法（对抗遗忘）。纯函数，便于单测。

export interface Sm2State {
  reps: number // 连续答对次数
  intervalDays: number // 当前间隔（天）
  ease: number // 难度因子 EF
  lapses: number // 累计遗忘/答错
}

export const INITIAL_SM2: Sm2State = { reps: 0, intervalDays: 0, ease: 2.5, lapses: 0 }

/** 把一次练习结果映射成 SM-2 质量分 q(0–5)。 */
export function gradeFrom(opts: {
  revealed: boolean
  correctBlanks: number
  totalBlanks: number
}): number {
  if (opts.revealed) return 1
  const ratio = opts.totalBlanks > 0 ? opts.correctBlanks / opts.totalBlanks : 0
  if (ratio >= 1) return 5
  if (ratio >= 0.6) return 3
  return 2
}

/** 标准 SM-2：旧状态 + 质量分 → 新状态。q<3 视为遗忘，间隔回到 1 天。 */
export function sm2(prev: Sm2State, q: number): Sm2State {
  let { reps, intervalDays, ease, lapses } = prev
  if (q >= 3) {
    if (reps === 0) intervalDays = 1
    else if (reps === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * ease)
    reps += 1
  } else {
    reps = 0
    intervalDays = 1
    lapses += 1
  }
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ease < 1.3) ease = 1.3
  return { reps, intervalDays, ease: Math.round(ease * 100) / 100, lapses }
}

/** nextReviewAt = base + intervalDays 天，返回 ISO 字符串。 */
export function nextReviewIso(intervalDays: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() + intervalDays)
  return d.toISOString()
}
