import app from '@adonisjs/core/services/app';
import { defineConfig, stores } from '@adonisjs/session';

import env from '#start/env';

const sessionConfig = defineConfig({
  /**
   * Enable or disable session support globally.
   */
  enabled: true,

  /**
   * Cookie name storing the session identifier.
   */
  cookieName: 'adonis-session',

  /**
   * When set to true, the session id cookie will be deleted
   * once the user closes the browser.
   */
  clearWithBrowser: false,

  /**
   * Define how long to keep the session data alive without
   * any activity.
   */
  age: '2h',

  /**
   * Configuration for session cookie and the
   * cookie store.
   */
  cookie: {
    /**
     * Restrict the cookie to a URL path. '/' means all routes.
     */
    path: '/',

    /**
     * Prevent JavaScript access to the cookie in the browser.
     */
    httpOnly: true,

    /**
     * Send cookies only over HTTPS in production.
     */
    secure: app.inProduction,

    /**
     * Cross-site policy for cookie sending.
     */
    sameSite: 'lax',
  },

  /**
   * Prefer redis so session tagging can revoke all devices after password reset.
   * Cookie store cannot enumerate sessions by user id.
   */
  store: env.get('SESSION_DRIVER'),

  /**
   * List of configured stores. Refer documentation to see
   * list of available stores and their config.
   */
  stores: {
    cookie: stores.cookie(),
    redis: stores.redis({
      connection: 'main',
    }),
    database: stores.database(),
  },
});

export default sessionConfig;
