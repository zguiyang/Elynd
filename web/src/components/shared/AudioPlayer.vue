<script setup lang="ts">
import { Play, Pause, RotateCcw, Volume2, Loader2, AlertCircle } from 'lucide-vue-next'
import type { AudioStatus } from '@/types/article'

interface Props {
  variant: 'full' | 'mini'
  isPlaying?: boolean
  currentTime?: number
  duration?: number
  audioStatus?: AudioStatus | null
}

interface Emits {
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'replay'): void
  (e: 'seek', time: number): void
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  currentTime: 0,
  duration: 180,
  audioStatus: null,
})

const emit = defineEmits<Emits>()

const canPlay = computed(() => {
  return props.audioStatus === 'completed'
})

const isGenerating = computed(() => {
  return props.audioStatus === 'pending' || props.audioStatus === 'processing'
})

const hasFailed = computed(() => {
  return props.audioStatus === 'failed'
})

const progress = computed(() => {
  if (props.duration === 0) return 0
  return Math.round((props.currentTime / props.duration) * 100)
})

const sliderModel = computed({
  get: () => [progress.value],
  set: (val: number[]) => {
    const percent = val[0] ?? 0
    emit('seek', (percent / 100) * props.duration)
  },
})

const togglePlay = () => {
  if (!canPlay.value) return
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

const handleReplay = () => {
  emit('replay')
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-if="props.variant === 'full'" class="flex items-center gap-2">
    <div v-if="isGenerating" class="flex items-center justify-center size-8 shrink-0">
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
    </div>
    <div v-else-if="hasFailed" class="flex items-center justify-center size-8 shrink-0">
      <AlertCircle class="size-4 text-destructive" />
    </div>
    <Button
      v-else
      size="icon"
      class="size-8 shrink-0"
      :disabled="!canPlay"
      @click="togglePlay"
    >
      <Play v-if="!props.isPlaying" class="size-3.5" />
      <Pause v-else class="size-3.5" />
    </Button>
    <Button variant="ghost" size="icon" class="size-7 shrink-0" :disabled="!canPlay" @click="handleReplay">
      <RotateCcw class="size-3.5" />
    </Button>
    <span class="text-xs text-muted-foreground shrink-0 tabular-nums min-w-12">
      {{ formatTime(props.currentTime) }}
    </span>
    <Slider v-model="sliderModel" class="flex-1" :max="100" :step="1" :disabled="!canPlay" />
    <span class="text-xs text-muted-foreground shrink-0 tabular-nums">
      {{ formatTime(props.duration) }}
    </span>
  </div>

  <div v-else class="flex items-center gap-3 px-4 h-14">
    <div v-if="isGenerating" class="flex items-center justify-center size-8 shrink-0">
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
    </div>
    <div v-else-if="hasFailed" class="flex items-center justify-center size-8 shrink-0">
      <AlertCircle class="size-4 text-destructive" />
    </div>
    <Button
      v-else
      size="icon"
      class="size-8 shrink-0"
      :disabled="!canPlay"
      @click="togglePlay"
    >
      <Play v-if="!props.isPlaying" class="size-4" />
      <Pause v-else class="size-4" />
    </Button>
    <Button variant="ghost" size="icon" class="size-7 shrink-0" :disabled="!canPlay" @click="handleReplay">
      <RotateCcw class="size-3.5" />
    </Button>
    <Volume2 class="size-4 text-muted-foreground shrink-0" />
    <Slider v-model="sliderModel" class="flex-1" :max="100" :step="1" :disabled="!canPlay" />
    <span class="text-xs text-muted-foreground shrink-0 tabular-nums">
      {{ formatTime(props.currentTime) }}
    </span>
  </div>
</template>
