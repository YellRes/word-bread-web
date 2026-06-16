import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ManagePage from './pages/ManagePage'
import PracticePage from './pages/PracticePage'

export default function App() {
  const [view, setView] = useState<'manage' | 'practice'>('manage')
  // 由「练习」按钮指定要练的文章；nonce 每次点击递增，确保重复/不同文章都能触发开练
  const [practiceArticleId, setPracticeArticleId] = useState<string>()
  const [practiceNonce, setPracticeNonce] = useState(0)

  const startArticlePractice = (articleId: string) => {
    setPracticeArticleId(articleId)
    setPracticeNonce(n => n + 1)
    setView('practice')
  }

  return (
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

      <Tabs value={view} onValueChange={v => setView(v as 'manage' | 'practice')}>
        <TabsList className="mb-4">
          <TabsTrigger value="manage">句子库</TabsTrigger>
          <TabsTrigger value="practice">练习</TabsTrigger>
        </TabsList>
        <TabsContent value="manage">
          <ManagePage onPractice={startArticlePractice} />
        </TabsContent>
        <TabsContent value="practice">
          <PracticePage initialArticleId={practiceArticleId} practiceNonce={practiceNonce} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
