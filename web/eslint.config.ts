import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],

  {
    name: 'app/vue-naming-rules',
    files: ['**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    },
  },

  // 禁止手动导入已自动导入的模块
  {
    name: 'app/no-restricted-imports',
    files: ['**/*.vue', '**/*.ts'],
    ignores: [
      // shadcn-vue 组件内部需要使用 VueUse
      '**/components/ui/**',
      // 路由配置需要手动导入
      '**/router/**',
      // VueUse 需要手动导入以提高代码可读性
      '**/composables/**',
      '**/views/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Vue APIs - 已通过 unplugin-auto-import 自动导入
            {
              group: ['vue'],
              importNames: ['ref', 'computed', 'watch', 'onMounted', 'onUnmounted', 'nextTick', 'reactive', 'toRefs'],
              message: 'Vue APIs are auto-imported. Do not import manually.',
            },
            // Vue Router - 已通过 unplugin-auto-import 自动导入
            {
              group: ['vue-router'],
              importNames: ['useRouter', 'useRoute'],
              message: 'Vue Router hooks are auto-imported. Do not import manually.',
            },
            // Pinia - 已通过 unplugin-auto-import 自动导入
            {
              group: ['pinia'],
              importNames: ['defineStore', 'storeToRefs'],
              message: 'Pinia APIs are auto-imported. Do not import manually.',
            },
          ],
        },
      ],
    },
  },

  vueTsConfigs.recommended,

  // Allow 'any' in test files for flexibility
  {
    name: 'app/test-any-allow',
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
