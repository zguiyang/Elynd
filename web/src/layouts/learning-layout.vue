<script setup lang="ts">
import { BookOpen, User, Settings, BookMarked } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const navigation = [
  { name: '学习', path: '/learning', icon: BookMarked },
  { name: '文章', path: '/learning/articles', icon: BookOpen },
]
</script>

<template>
  <div class="h-dvh flex flex-col bg-background">
    <!-- Header -->
    <header class="flex-none border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <!-- Logo -->
        <RouterLink to="/learning" class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen class="size-5 text-primary-foreground" />
          </div>
          <span class="text-xl font-semibold">Elynd</span>
        </RouterLink>

        <!-- Navigation -->
        <nav class="hidden md:flex items-center gap-1">
          <RouterLink
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.name }}
          </RouterLink>
        </nav>

        <!-- User Menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="rounded-full">
              <Avatar class="size-8">
                <AvatarImage :src="authStore.user?.avatar || ''" alt="User" />
                <AvatarFallback>
                  <User class="size-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem as-child>
              <RouterLink to="/learning/profile" class="flex items-center cursor-pointer">
                <User class="mr-2 size-4" />
                <span>个人资料</span>
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <RouterLink to="/learning/settings" class="flex items-center cursor-pointer">
                <Settings class="mr-2 size-4" />
                <span>设置</span>
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="authStore.logout()">
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 min-h-0 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
