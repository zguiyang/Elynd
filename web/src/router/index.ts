import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/index.vue'),
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/layouts/auth-layout.vue'),
      redirect: '/auth/sign-in',
      children: [
        {
          path: 'sign-in',
          name: 'sign-in',
          component: () => import('@/views/auth/sign-in.vue'),
        },
        {
          path: 'sign-up',
          name: 'sign-up',
          component: () => import('@/views/auth/sign-up.vue'),
        },
        {
          path: 'forgot-password',
          name: 'forgot-password',
          component: () => import('@/views/auth/forgot-password.vue'),
        },
        {
          path: 'reset-password',
          name: 'reset-password',
          component: () => import('@/views/auth/reset-password.vue'),
        },
      ],
    },
    {
      path: '/learning',
      name: 'learning',
      component: () => import('@/layouts/learning-layout.vue'),
      redirect: '/learning',
      children: [
        {
          path: '',
          name: 'learning-index',
          component: () => import('@/views/learning/learning-index.vue'),
        },
        {
          path: 'articles',
          name: 'learning-articles',
          component: () => import('@/views/learning/learning-articles.vue'),
        },
        {
          path: 'article/:id',
          name: 'learning-article',
          component: () => import('@/views/learning/learning-article.vue'),
        },
      ],
    },
  ],
})

export default router
