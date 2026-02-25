import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BookOpenIcon,
  HeadphonesIcon,
  SpellCheck,
  SparklesIcon,
  ArrowRightIcon,
  PlayCircleIcon,
} from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const FEATURES = [
  {
    icon: BookOpenIcon,
    title: 'AI 智能阅读',
    description: '精选原版文章，AI 智能推荐适合你水平的阅读内容，让学习更高效',
  },
  {
    icon: HeadphonesIcon,
    title: '听读一体',
    description: '内置语音朗读，支持播放、暂停、重播，边听边读培养语感',
  },
  {
    icon: SpellCheck,
    title: '即点即查',
    description: '点击任意单词立即查看释义，中英双语解释，轻松积累词汇量',
  },
  {
    icon: SparklesIcon,
    title: 'AI 问答助手',
    description: '针对文章内容向 AI 提问，获得详细解答，加深理解',
  },
]

const STEPS = [
  {
    number: '01',
    title: '选择文章',
    description: '从难度分级的内容库中选择适合自己的文章',
  },
  {
    number: '02',
    title: '开始阅读',
    description: '阅读文章内容，点击生词查看释义，听读结合',
  },
  {
    number: '03',
    title: '向 AI 提问',
    description: '针对不理解的内容向 AI 提问，获得即时解答',
  },
]

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <HugeiconsIcon icon={BookOpenIcon} className="size-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">Elynd</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              功能介绍
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              使用流程
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <a href="/auth/sign-in">登录</a>
            </Button>
            <Button size="sm" asChild>
              <a href="/auth/sign-up">免费开始</a>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute right-0 top-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-3xl" />
        </div>
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-6">
              <HugeiconsIcon icon={SparklesIcon} className="size-3.5 mr-1" />
              AI 辅助英语阅读学习
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              让英语阅读
              <span className="text-primary">变得更简单</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              专为职场人士打造的 AI 辅助英语阅读工具。通过阅读、听读、查词、AI 提问，
              轻松提升英语能力，不再为英语发愁。
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <a href="/auth/sign-up">
                  免费开始学习
                  <HugeiconsIcon icon={ArrowRightIcon} className="size-4 ml-2" />
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                <a href="#features">
                  <HugeiconsIcon icon={PlayCircleIcon} className="size-4 mr-2" />
                  了解更多
                </a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              无需信用卡，立即开始
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              一站式英语学习体验
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              整合阅读、听力、查词、AI 问答四大核心功能
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, index) => (
              <Card 
                key={feature.title} 
                className="group border-muted hover:border-primary/30 transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <HugeiconsIcon icon={feature.icon} className="size-6" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              三步开启学习之旅
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              简单易上手，快速进入学习状态
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, index) => (
              <div key={step.number} className="relative">
                {index < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-border" />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <HugeiconsIcon icon={BookOpenIcon} className="size-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Elynd</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Elynd. AI 辅助英语阅读学习工具。
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
