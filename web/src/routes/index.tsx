import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BookOpenIcon,
  SparklesIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  FileIcon,
  TranslateIcon,
  BrainCircuit,
  LinkSquare01Icon,
  VideoReplayIcon,
  QuestionIcon,
  Sparkles,
  BookCheck,
  AiAudioIcon,
} from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const PAIN_POINTS = [
  {
    icon: FileIcon,
    title: '材料难度不匹配',
    description: '纯英文内容太难，有中文的又太简单，总是找不到适合自己"i+1"难度的学习材料',
  },
  {
    icon: TranslateIcon,
    title: '母语干扰',
    description: '即便有中英文对照，注意力也会被中文吸引，无法真正沉浸在新语言中',
  },
  {
    icon: BrainCircuit,
    title: '词汇场景脱节',
    description: '背的单词与生活、工作场景脱节，无法形成关联记忆，总是背了又忘',
  },
  {
    icon: LinkSquare01Icon,
    title: '听读材料割裂',
    description: '有原文没有音频，有音频没有原文，听读分离导致学习无法闭环',
  },
  {
    icon: VideoReplayIcon,
    title: '视听困难',
    description: '看YouTube学习进度太慢，纯英文听不懂，太简单的又没用',
  },
  {
    icon: QuestionIcon,
    title: '问题无法及时解答',
    description: '学习过程中遇到语法、词汇、语境等问题，无法及时获得答案，只能暂停学习去搜索',
  },
]

const SOLUTION_POINTS = [
  {
    icon: Sparkles,
    title: 'AI 智能匹配',
    description: 'AI 分析你的水平，推荐或生成"i+1"难度的学习材料',
  },
  {
    icon: BookCheck,
    title: '单词词典',
    description: 'AI 自动提取材料核心词汇，带语境例句，边学边记',
  },
  {
    icon: AiAudioIcon,
    title: '听读一体',
    description: '同一份材料同时提供原文和音频，边听边读培养语感',
  },
  {
    icon: QuestionIcon,
    title: 'AI 问答',
    description: '随时针对材料提问，AI 实时解答，学习不中断',
  },
]

const FEATURES = [
  {
    icon: BookOpenIcon,
    title: 'AI 智能阅读',
    description: '精选原版文章，AI 智能推荐适合你水平的阅读内容，让学习更高效',
  },
  {
    icon: PlayCircleIcon,
    title: '听读一体',
    description: '内置语音朗读，支持播放、暂停、重播，边听边读培养语感',
  },
  {
    icon: TranslateIcon,
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
            <a href="#why-elynd" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              为什么做
            </a>
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

      {/* Why Elynd Section */}
      <section id="why-elynd" className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-0 top-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute right-0 bottom-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              真实痛点
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              我们在英语学习中遇到的困境
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              这也是我们做 Elynd 的原因——每一个困境我们都亲身经历过
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PAIN_POINTS.map((point, index) => (
              <Card 
                key={point.title}
                className={`border-muted hover:border-primary/30 transition-all duration-300 hover:shadow-lg ${
                  index % 2 === 1 ? 'md:mt-0 lg:mt-12' : ''
                }`}
              >
                <CardHeader>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={point.icon} className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{point.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {point.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="py-20 lg:py-28 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              解决方案
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              以输入材料为核心的闭环学习
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              平台通过 AI 分析你的水平，推荐或生成适合你的学习材料，让英语学习真正闭环
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SOLUTION_POINTS.map((point) => (
              <Card 
                key={point.title}
                className="border-muted hover:border-primary/30 transition-all duration-300 hover:shadow-lg group"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex shrink-0 h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <HugeiconsIcon icon={point.icon} className="size-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">{point.title}</h3>
                      <p className="text-muted-foreground">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              三步开启学习之旅
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              简单易上手，快速进入学习状态
            </p>
          </div>
          
          <div className="relative">
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-0.5 bg-border" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.number} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold shadow-lg">
                    {step.number}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
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
