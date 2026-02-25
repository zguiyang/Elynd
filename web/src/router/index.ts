import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/auth/sign-in',
      name: 'sign-in',
      component: () => import('../views/auth/SignIn.vue'),
    },
    {
      path: '/auth/sign-up',
      name: 'sign-up',
      component: () => import('../views/auth/SignUp.vue'),
    },
    {
      path: '/auth/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPassword.vue'),
    },
    {
      path: '/auth/reset-password',
      name: 'reset-password',
      component: () => import('../views/auth/ResetPassword.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/about.vue'),
    },
  ],
})

export default router
