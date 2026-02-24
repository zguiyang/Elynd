<template>
  <div class="marketing-layout">
    <ambient-background />

    <slot />
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.marketing-layout {
  position: relative;
  min-height: 100vh;
}
</style>
