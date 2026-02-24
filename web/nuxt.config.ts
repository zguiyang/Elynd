// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/icon', '@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt', '@vueuse/nuxt'],
  components: [
    {
      path: '~/components',
      pathPrefix: false
    }
  ],

  devtools: {
    enabled: true
  },
  css: ['~/assets/css/main.css'],
  ui: {
    fonts: false
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL,
      apiPrefix: process.env.NUXT_PUBLIC_API_PREFIX || '/api',
      staticFileUrl: process.env.NUXT_PUBLIC_STATIC_FILE_URL,
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Elynd'
    }
  },

  future: {
    compatibilityVersion: 4
  },
  vite: {
    esbuild: process.env.NODE_ENV === 'production'
      ? {
          drop: ['console', 'debugger']
        }
      : undefined
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  icon: {
    localApiEndpoint: '/_nuxt_icon',
    serverBundle: {
      collections: ['lucide', 'heroicons']
    }
  },
  pinia: {
    storesDirs: ['app/stores/**']
  }
})
