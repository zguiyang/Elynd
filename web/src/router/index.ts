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
  ],
})

export default router
