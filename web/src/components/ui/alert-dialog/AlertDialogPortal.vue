<script setup lang="ts">
import type { AlertDialogPortalProps } from "reka-ui"
import { AlertDialogPortal, useForwardProps } from "reka-ui"

const props = defineProps<AlertDialogPortalProps>()

const forwarded = useForwardProps(props)
</script>

<template>
  <AlertDialogPortal
    data-slot="alert-dialog-portal"
    v-bind="forwarded"
  >
    <slot />
  </AlertDialogPortal>
</template>
