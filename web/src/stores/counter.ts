export const useCounterStore = defineStore('counter', () => {
  const { count, inc: increment, dec: decrement, set, reset } = useCounter(0)
  const doubleCount = computed(() => count.value * 2)

  return { count, doubleCount, increment, decrement, set, reset }
})
