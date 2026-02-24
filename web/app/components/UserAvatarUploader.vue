<script setup lang="ts">
defineOptions({ name: 'UserAvatarUploader' })

const props = defineProps<{
  currentAvatar: string | null
  userName?: string
}>()

const emit = defineEmits<{
  upload: [file: File]
  remove: []
}>()

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const previewUrl = ref<string | null>(null)

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const MAX_SIZE = 200 * 1024

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.add({
      title: '不支持的文件格式',
      description: '请选择 JPG、PNG 或 GIF 格式的图片',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
    return
  }

  if (file.size > MAX_SIZE) {
    toast.add({
      title: '文件过大',
      description: '头像文件大小不能超过 200KB',
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
    return
  }

  previewUrl.value = URL.createObjectURL(file)
}

const cancelPreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const handleRemove = () => {
  if (previewUrl.value) {
    cancelPreview()
  }
  isUploading.value = false
  emit('remove')
}

const handleConfirm = () => {
  if (previewUrl.value && fileInput.value?.files?.[0]) {
    isUploading.value = true
    emit('upload', fileInput.value.files[0])
  }
}

watch(() => props.currentAvatar, () => {
  if (previewUrl.value) {
    cancelPreview()
  }
  isUploading.value = false
})
</script>

<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-8 p-6 rounded-2xl bg-(--bg-surface) border border-(--border-subtle)">
    <div class="relative">
      <u-avatar
        :src="previewUrl || currentAvatar || undefined"
        :alt="userName || 'User'"
        size="xl"
        class="ring-4 ring-primary-500/10"
      >
        <template #fallback>
          {{ (userName || 'U').charAt(0).toUpperCase() }}
        </template>
      </u-avatar>

      <div
        v-if="isUploading"
        class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"
      >
        <u-icon
          name="i-heroicons-arrow-path"
          class="animate-spin text-white size-8"
        />
      </div>
    </div>

    <div class="space-y-3">
      <div class="flex flex-wrap gap-3">
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/gif"
          class="hidden"
          @change="handleFileChange"
        >

        <u-button
          v-if="!previewUrl"
          color="primary"
          variant="soft"
          icon="i-heroicons-cloud-arrow-up"
          size="sm"
          @click="triggerFileSelect"
        >
          更换头像
        </u-button>

        <u-button
          v-else
          color="primary"
          variant="soft"
          icon="i-heroicons-check"
          size="sm"
          :loading="isUploading"
          @click="handleConfirm"
        >
          确认上传
        </u-button>

        <u-button
          v-if="currentAvatar || previewUrl"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          size="sm"
          :disabled="isUploading"
          @click="handleRemove"
        >
          移除
        </u-button>

        <u-button
          v-if="previewUrl"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          size="sm"
          :disabled="isUploading"
          @click="cancelPreview"
        >
          取消
        </u-button>
      </div>

      <p class="text-xs text-(--text-muted)">
        支持 JPG、PNG 或 GIF。最大文件大小 200KB。
      </p>
    </div>
  </div>
</template>
