<script setup lang="ts">
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  PlayCircle,
  FileText,
  Globe,
  Brain,
  Link,
  Video,
  HelpCircle,
  Mail,
  MessageSquare,
} from 'lucide-vue-next'

const PAIN_POINTS = [
  {
    icon: FileText,
    title: '材料难度不匹配',
    description: '纯英文内容太难，有中文的又太简单，总是找不到适合自己"i+1"难度的学习材料',
  },
  {
    icon: Globe,
    title: '母语干扰',
    description: '即便有中英文对照，注意力也会被中文吸引，无法真正沉浸在新语言中',
  },
  {
    icon: Brain,
    title: '词汇场景脱节',
    description: '背的单词与生活、工作场景脱节，无法形成关联记忆，总是背了又忘',
  },
  {
    icon: Link,
    title: '听读材料割裂',
    description: '有原文没有音频，有音频没有原文，听读分离导致学习无法闭环',
  },
  {
    icon: Video,
    title: '视听困难',
    description: '看YouTube学习进度太慢，纯英文听不懂，太简单的又没用',
  },
  {
    icon: HelpCircle,
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
    icon: BookOpen,
    title: '单词词典',
    description: 'AI 自动提取材料核心词汇，带语境例句，边学边记',
  },
  {
    icon: PlayCircle,
    title: '听读一体',
    description: '同一份材料同时提供原文和音频，边听边读培养语感',
  },
  {
    icon: HelpCircle,
    title: 'AI 问答',
    description: '随时针对材料提问，AI 实时解答，学习不中断',
  },
]

const FEATURES = [
  {
    icon: BookOpen,
    title: 'AI 智能阅读',
    description: '精选原版文章，AI 智能推荐适合你水平的阅读内容，让学习更高效',
  },
  {
    icon: PlayCircle,
    title: '听读一体',
    description: '内置语音朗读，支持播放、暂停、重播，边听边读培养语感',
  },
  {
    icon: Globe,
    title: '即点即查',
    description: '点击任意单词立即查看释义，中英双语解释，轻松积累词汇量',
  },
  {
    icon: Sparkles,
    title: 'AI 问答助手',
    description: '针对文章内容向 AI 提问，获得详细解答，加深理解',
  },
]

const STEPS = [
  {
    number: '01',
    title: '选择文章',
    description: '从海量精选库中，选择适合你兴趣和水平的文章进行阅读。',
  },
  {
    number: '02',
    title: '沉浸阅读',
    description: '在 AI 的辅助下，通过听读、查词等功能，深度理解文章内容。',
  },
  {
    number: '03',
    title: '巩固提升',
    description: '针对难点进行 AI 提问，系统记录生词，在阅读中不断进步。',
  },
]

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Preview Banner -->
    <div class="fixed top-0 left-0 right-0 z-[60] bg-primary px-4 py-2 text-primary-foreground">
      <div class="container mx-auto flex items-center justify-center gap-2 text-center text-sm font-medium">
        <Sparkles class="size-4 shrink-0" />
        <span>Elynd 目前处于预览版本，核心功能持续迭代完善中，敬请期待！</span>
      </div>
    </div>

    <!-- Navigation -->
    <header class="fixed top-9 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <nav class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen class="size-5 text-primary-foreground" />
          </div>
          <span class="text-xl font-semibold">Elynd</span>
        </div>
        <div class="hidden md:flex items-center gap-8">
          <a
            href="#why-elynd"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            为什么做
          </a>
          <a
            href="#features"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            功能介绍
          </a>
          <a
            href="#how-it-works"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            使用流程
          </a>
        </div>
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            <a href="/auth/sign-in">登录</a>
          </Button>
          <Button size="sm">
            <a href="/auth/sign-up">免费开始</a>
          </Button>
        </div>
      </nav>
    </header>

    <!-- Hero Section -->
    <section class="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
      <div class="absolute inset-0 -z-10">
        <div
          class="absolute left-1/2 top-0 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 rounded-full blur-3xl"
        />
        <div
          class="absolute right-0 top-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-3xl"
        />
      </div>

      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" class="mb-6">
            <Sparkles class="size-3.5 mr-1" />
            AI 辅助英语阅读学习
          </Badge>
          <h1 class="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            让英语阅读
            <span class="text-primary">变得更简单</span>
          </h1>
          <p class="mt-6 text-lg text-muted-foreground leading-relaxed">
            专为职场人士打造的 AI 辅助英语阅读工具。通过阅读、听读、查词、AI 提问，
            轻松提升英语能力，不再为英语发愁。
          </p>
          <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" class="w-full sm:w-auto">
              <a href="/auth/sign-up" class="inline-flex items-center">
                免费开始学习
                <ArrowRight class="size-4 ml-2" />
              </a>
            </Button>
            <Button variant="outline" size="lg" class="w-full sm:w-auto">
              <a href="#features" class="inline-flex items-center">
                <PlayCircle class="size-4 mr-2" />
                了解更多
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- Why Elynd Section -->
    <section id="why-elynd" class="py-20 lg:py-28 relative overflow-hidden">
      <div class="absolute inset-0 -z-10">
        <div class="absolute left-0 top-0 w-125 h-125 bg-primary/5 rounded-full blur-3xl" />
        <div class="absolute right-0 bottom-0 w-100 h-100 bg-secondary/5 rounded-full blur-3xl" />
      </div>
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <Badge variant="outline" class="mb-4"> 真实痛点 </Badge>
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">我们在英语学习中遇到的困境</h2>
          <p class="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            这也是我们做 Elynd 的原因——每一个困境我们都亲身经历过
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            v-for="(point, index) in PAIN_POINTS"
            :key="point.title"
            :class="[
              'border-muted hover:border-primary/30 transition-all duration-300 hover:shadow-lg',
              index % 2 === 1 ? 'md:mt-0 lg:mt-12' : '',
            ]"
          >
            <CardHeader>
              <div
                class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              >
                <component :is="point.icon" class="size-5" />
              </div>
              <CardTitle class="text-lg">{{ point.title }}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription class="text-base">
                {{ point.description }}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <!-- Solution Section -->
    <section id="solution" class="py-20 lg:py-28 bg-muted/30">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <Badge variant="outline" class="mb-4"> 解决方案 </Badge>
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">以输入材料为核心的闭环学习</h2>
          <p class="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            平台通过 AI 分析你的水平，推荐或生成适合你的学习材料，让英语学习真正闭环
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            v-for="point in SOLUTION_POINTS"
            :key="point.title"
            class="border-muted hover:border-primary/30 transition-all duration-300 hover:shadow-lg group"
          >
            <CardContent class="pt-6">
              <div class="flex items-start gap-4">
                <div
                  class="flex shrink-0 h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                >
                  <component :is="point.icon" class="size-7" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold mb-1">{{ point.title }}</h3>
                  <p class="text-muted-foreground">
                    {{ point.description }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 lg:py-28">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">一站式英语学习体验</h2>
          <p class="mt-4 text-lg text-muted-foreground">
            整合阅读、听力、查词、AI 问答四大核心功能
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card
            v-for="(feature, index) in FEATURES"
            :key="feature.title"
            class="group border-muted hover:border-primary/30 transition-all duration-300"
            :style="{ animationDelay: `${index * 100}ms` }"
          >
            <CardHeader>
              <div
                class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
              >
                <component :is="feature.icon" class="size-6" />
              </div>
              <CardTitle>{{ feature.title }}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription class="text-base">
                {{ feature.description }}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="py-20 lg:py-28">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">三步开启学习之旅</h2>
          <p class="mt-4 text-lg text-muted-foreground">简单易上手，快速进入学习状态</p>
        </div>

        <div class="relative">
          <div class="hidden md:block absolute top-8 left-[20%] right-[20%] h-0.5 bg-border" />
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div
              v-for="step in STEPS"
              :key="step.number"
              class="relative flex flex-col items-center text-center"
            >
              <div
                class="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold shadow-lg"
              >
                {{ step.number }}
              </div>
              <h3 class="mt-6 text-xl font-semibold">{{ step.title }}</h3>
              <p class="mt-2 text-muted-foreground">{{ step.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Feedback Section -->
    <section class="py-24 border-t border-muted/30">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl text-center">
          <div class="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <MessageSquare class="size-4" />
            <span>联系开发者</span>
          </div>
          <h2 class="text-3xl font-bold tracking-tight">期待您的反馈</h2>
          <p class="mt-4 text-lg text-muted-foreground">
            您的每一条建议对我都至关重要。
            如有任何问题，欢迎随时联系。
          </p>
          <div class="mt-8 flex items-center justify-center">
            <a
              href="mailto:zhaoguiyang18@outlook.com"
              class="group relative inline-flex items-center gap-2 text-lg font-medium text-foreground hover:text-primary transition-colors"
            >
              <Mail class="size-5 text-primary" />
              <span>zhaoguiyang18@outlook.com</span>
              <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t bg-muted/20">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 py-8">
          <div class="flex items-center gap-2">
            <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <BookOpen class="size-4 text-primary-foreground" />
            </div>
            <span class="font-semibold">Elynd</span>
          </div>
          <p class="text-sm text-muted-foreground">© 2024 Elynd. AI 辅助英语阅读学习工具。</p>
        </div>
      </div>
    </footer>

  </div>
</template>
