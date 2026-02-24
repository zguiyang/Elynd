<template>
  <u-popover
    :close-delay="closeDelay"
    :content="{ align, sideOffset: 8 }"
  >
    <slot>
      <u-button
        :icon="triggerIcon"
        :label="triggerLabel"
        :color="triggerColor"
        :variant="triggerVariant"
        :size="triggerSize"
      />
    </slot>

    <template #content="{ close }">
      <div class="popover-content">
        <div
          class="icon-container"
          :class="iconContainerClass"
        >
          <u-icon
            :name="currentIcon"
            class="icon"
            :class="iconClass"
          />
        </div>

        <p class="confirm-title">
          {{ title }}
        </p>

        <p
          v-if="description"
          class="confirm-description"
        >
          {{ description }}
        </p>

        <div class="button-group">
          <u-button
            :label="cancelText"
            variant="ghost"
            class="cancel-btn"
            @click="handleCancel(close)"
          />
          <u-button
            :label="confirmText"
            :color="confirmColor"
            :loading="confirmLoading"
            class="confirm-btn"
            @click="handleConfirm(close)"
          />
        </div>
      </div>
    </template>
  </u-popover>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
  cancelText?: string
  confirmLoading?: boolean
  align?: 'start' | 'center' | 'end'
  closeDelay?: number
  triggerIcon?: string
  triggerLabel?: string
  triggerColor?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  triggerVariant?: 'link' | 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost'
  triggerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  confirmColor?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
}

const props = withDefaults(defineProps<Props>(), {
  title: '确定要删除吗？',
  type: 'warning',
  confirmText: '删除',
  cancelText: '取消',
  confirmLoading: false,
  align: 'center',
  closeDelay: 200,
  triggerIcon: 'i-heroicons-trash',
  triggerColor: 'neutral',
  triggerVariant: 'ghost',
  triggerSize: 'md',
  confirmColor: 'error'
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const iconConfig: Record<string, { icon: string, iconClass: string, containerClass: string }> = {
  info: {
    icon: 'i-heroicons-information-circle',
    iconClass: 'text-info',
    containerClass: 'bg-info/10'
  },
  success: {
    icon: 'i-heroicons-check-circle',
    iconClass: 'text-success',
    containerClass: 'bg-success/10'
  },
  warning: {
    icon: 'i-heroicons-exclamation-triangle',
    iconClass: 'text-warning',
    containerClass: 'bg-warning/10'
  },
  error: {
    icon: 'i-heroicons-x-circle',
    iconClass: 'text-error',
    containerClass: 'bg-error/10'
  }
}

const typeKey = computed(() => {
  const validTypes = ['info', 'success', 'warning', 'error'] as const
  const type = props.type
  return validTypes.includes(type as any) ? type : 'warning'
})

const currentIcon = computed(() => iconConfig[typeKey.value]?.icon ?? iconConfig.warning!.icon)
const iconClass = computed(() => iconConfig[typeKey.value]?.iconClass ?? iconConfig.warning!.iconClass)
const iconContainerClass = computed(() => iconConfig[typeKey.value]?.containerClass ?? iconConfig.warning!.containerClass)

const handleConfirm = (close: () => void) => {
  emit('confirm')
  close()
}

const handleCancel = (close: () => void) => {
  emit('cancel')
  close()
}
</script>

<style scoped>
.popover-content {
  width: 240px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.icon-container {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.icon {
  width: 24px;
  height: 24px;
}

.confirm-title {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.confirm-description {
  font-size: 13px;
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.button-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.cancel-btn {
  flex: 1;
}

.confirm-btn {
  flex: 1;
}
</style>
