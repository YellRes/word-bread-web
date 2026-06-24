import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import ManagePage from './pages/ManagePage'
import PracticePage from './pages/PracticePage'
import WrongPage from './pages/WrongPage'
import StatsPage from './pages/StatsPage'
import type { DBSentence } from './types/index'

type View = 'manage' | 'practice' | 'wrong' | 'stats'

export default function App() {
  const [view, setView] = useState<View>('manage')
  // 由「练习」按钮指定要练的文章；nonce 每次点击递增，确保重复/不同文章都能触发开练
  const [practiceArticleId, setPracticeArticleId] = useState<string>()
  // 错题本重练：直接指定句子集 + 标题
  const [customSentences, setCustomSentences] = useState<DBSentence[]>()
  const [customTitle, setCustomTitle] = useState<string>()
  const [practiceNonce, setPracticeNonce] = useState(0)

  const startArticlePractice = (articleId: string) => {
    setCustomSentences(undefined)
    setCustomTitle(undefined)
    setPracticeArticleId(articleId)
    setPracticeNonce(n => n + 1)
    setView('practice')
  }

  const startCustomPractice = (sentences: DBSentence[], title: string) => {
    setPracticeArticleId(undefined)
    setCustomSentences(sentences)
    setCustomTitle(title)
    setPracticeNonce(n => n + 1)
    setView('practice')
  }

  return (
    <TooltipProvider>
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      {/* 品牌 header */}
      <header className="mb-6 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <BookOpen className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WordBread</h1>
          <p className="text-sm text-muted-foreground">双语句子学习库</p>
        </div>
      </header>

      <Tabs value={view} onValueChange={v => setView(v as View)}>
        <TabsList className="mb-4">
          <TabsTrigger value="manage">句子库</TabsTrigger>
          <TabsTrigger value="practice">练习</TabsTrigger>
          <TabsTrigger value="wrong">错题本</TabsTrigger>
          <TabsTrigger value="stats">数据</TabsTrigger>
        </TabsList>
        <TabsContent value="manage">
          <ManagePage onPractice={startArticlePractice} />
        </TabsContent>
        <TabsContent value="practice">
          <PracticePage
            initialArticleId={practiceArticleId}
            customSentences={customSentences}
            customTitle={customTitle}
            practiceNonce={practiceNonce}
          />
        </TabsContent>
        <TabsContent value="wrong">
          <WrongPage onPractice={startCustomPractice} />
        </TabsContent>
        <TabsContent value="stats">
          <StatsPage onPractice={startCustomPractice} />
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  )
}
