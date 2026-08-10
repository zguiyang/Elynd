import { defineConfig } from '@foadonis/openapi';

export default defineConfig({
  ui: 'swagger',
  document: {
    info: {
      title: 'Elynd API',
      version: '0.0.0',
    },
  },
});
