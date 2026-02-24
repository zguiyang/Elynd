import limiter from '@adonisjs/limiter/services/main'

export const apiLimiter = limiter.define('api', () => {
  return limiter.allowRequests(60).every('1 minute')
})

export const authLimiter = limiter.define('auth', () => {
  return limiter.allowRequests(10).every('1 minute')
})

export const searchLimiter = limiter.define('search', () => {
  return limiter.allowRequests(30).every('1 minute')
})

export const aiChatLimiter = limiter.define('aiChat', () => {
  return limiter.allowRequests(10).every('1 minute')
})
