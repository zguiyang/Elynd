import { ref, onMounted, onUnmounted } from 'vue'

export const useLayout = () => {
  const isMobile = ref(false)
  const showSidebar = ref(false)
  const showSearch = ref(false)

  const checkDevice = () => {
    isMobile.value = window.innerWidth < 1024
  }

  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value
  }

  const toggleSearch = () => {
    showSearch.value = !showSearch.value
  }

  const closeSidebar = () => {
    showSidebar.value = false
  }

  const closeSearch = () => {
    showSearch.value = false
  }

  onMounted(() => {
    checkDevice()
    window.addEventListener('resize', checkDevice)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkDevice)
  })

  return {
    isMobile,
    showSidebar,
    showSearch,
    toggleSidebar,
    toggleSearch,
    closeSidebar,
    closeSearch
  }
}
