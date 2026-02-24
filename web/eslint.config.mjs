// @ts-check
import vueComposable from 'eslint-plugin-vue-composable'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    plugins: {
      'vue-composable': vueComposable
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',

      'vue/component-name-in-template-casing': ['error', 'kebab-case', {
        registeredComponentsOnly: false,
        ignores: []
      }],

      'vue-composable/composable-placement': 'error',

      'vue-composable/lifecycle-placement': 'error',

      'vue/define-macros-order': ['error', {
        order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots']
      }],

      'vue/define-props-destructuring': 'off'
    }
  },
  {
    files: ['app/middleware/**'],
    rules: {
      'vue-composable/composable-placement': 'off'
    }
  }
  // Your custom configs here
)
