import { configApp } from '@adonisjs/eslint-config';

export default configApp({
  rules: {
    '@stylistic/max-len': ['error', { code: 120, comments: 120, ignoreUrls: true, ignoreTemplateLiterals: true }],
  },
});
