<script setup lang="ts">
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-vue-next'

interface Props {
  variant: 'full' | 'mini'
  isPlaying?: boolean
  currentTime?: number
  duration?: number
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
})

const emit = defineEmits<Emits>()

const progress = computed(() => {
  if (props.duration === 0) return 0
  return (props.currentTime / props.duration) * 100
})

const togglePlay = () => {
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

const handleReplay = () => {
  emit('replay')
}

const handleSeek = (event: Event) => {
  const target = event.target as HTMLInputElement
  const time = (parseFloat(target.value) / 100) * props.duration
  emit('seek', time)
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-if="props.variant === 'full'" class="space-y-3">
    <div class="flex items-center gap-2">
      <Button size="icon" class="size-9 shrink-0" @click="togglePlay">
        <Play v-if="!props.isPlaying" class="size-4" />
        <Pause v-else class="size-4" />
      </Button>
      <Button variant="ghost" size="icon" class="size-8 shrink-0" @click="handleReplay">
        <RotateCcw class="size-4" />
      </Button>
    </div>

    <div class="flex items-center gap-2">
      <Volume2 class="size-4 text-muted-foreground shrink-0" />
      <input
        type="range"
        min="0"
        max="100"
        :value="progress"
        class="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
        @input="handleSeek"
      />
    </div>

    <div class="text-xs text-muted-foreground">
      {{ formatTime(props.currentTime) }} / {{ formatTime(props.duration) }}
    </div>
  </div>

  <div v-else class="flex items-center gap-3 px-4 h-14">
    <Button size="icon" class="size-8 shrink-0" @click="togglePlay">
      <Play v-if="!props.isPlaying" class="size-4" />
      <Pause v-else class="size-4" />
    </Button>
    <Button variant="ghost" size="icon" class="size-7 shrink-0" @click="handleReplay">
      <RotateCcw class="size-3.5" />
    </Button>
    <Volume2 class="size-4 text-muted-foreground shrink-0" />
    <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        class="h-full bg-primary rounded-full transition-all"
        :style="{ width: `${progress}%` }"
      />
    </div>
    <span class="text-xs text-muted-foreground shrink-0">{{ formatTime(props.currentTime) }}</span>
  </div>
</template>
