import { createRouter, createWebHistory } from 'vue-router'
import { setupAuthGuard } from './guards/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/index.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/layouts/auth-layout.vue'),
      redirect: '/auth/sign-in',
      meta: { requiresAuth: false },
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
      meta: { requiresAuth: true },
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
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/profile/profile-view.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/settings/settings-view.vue'),
        },
      ],
    },
    {
      path: '/learning/article/:id',
      name: 'learning-article',
      component: () => import('@/layouts/article-reading-layout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'learning-article-content',
          component: () => import('@/views/learning/learning-article.vue'),
        },
      ],
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/layouts/admin-layout.vue'),
      redirect: '/admin/articles/generate',
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: 'articles/generate',
          name: 'admin-articles-generate',
          component: () => import('@/views/admin/articles-generate-view.vue'),
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('@/views/admin/settings-view.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(setupAuthGuard)

export default router
