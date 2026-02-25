<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BookOpenIcon } from 'lucide-vue-next'
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <header class="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <nav class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <RouterLink to="/" class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpenIcon class="size-5 text-primary-foreground" />
          </div>
          <span class="text-xl font-semibold">Elynd</span>
        </RouterLink>
      </nav>
    </header>

    <main class="flex-1 flex items-center justify-center px-4 py-8 min-h-[calc(100vh-8rem)]">
      <router-view />
    </main>

    <footer class="border-t py-6">
      <div class="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
        © 2024 Elynd. All rights reserved.
      </div>
    </footer>
  </div>
</template>
