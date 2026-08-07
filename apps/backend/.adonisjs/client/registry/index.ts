/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.register': {
    methods: ["POST"],
    pattern: '/api/v1/auth/register',
    tokens: [{"old":"/api/v1/auth/register","type":0,"val":"api","end":""},{"old":"/api/v1/auth/register","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/register","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/register","type":0,"val":"register","end":""}],
    types: placeholder as Registry['auth.register']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.logout': {
    methods: ["DELETE"],
    pattern: '/api/v1/auth/logout',
    tokens: [{"old":"/api/v1/auth/logout","type":0,"val":"api","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'auth.me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/me',
    tokens: [{"old":"/api/v1/auth/me","type":0,"val":"api","end":""},{"old":"/api/v1/auth/me","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/me","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['auth.me']['types'],
  },
  'auth.email_verify_get': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/email/verify',
    tokens: [{"old":"/api/v1/auth/email/verify","type":0,"val":"api","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"email","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"verify","end":""}],
    types: placeholder as Registry['auth.email_verify_get']['types'],
  },
  'auth.email_verify_post': {
    methods: ["POST"],
    pattern: '/api/v1/auth/email/verify',
    tokens: [{"old":"/api/v1/auth/email/verify","type":0,"val":"api","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"email","end":""},{"old":"/api/v1/auth/email/verify","type":0,"val":"verify","end":""}],
    types: placeholder as Registry['auth.email_verify_post']['types'],
  },
  'auth.resend_verification': {
    methods: ["POST"],
    pattern: '/api/v1/auth/email/resend',
    tokens: [{"old":"/api/v1/auth/email/resend","type":0,"val":"api","end":""},{"old":"/api/v1/auth/email/resend","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/email/resend","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/email/resend","type":0,"val":"email","end":""},{"old":"/api/v1/auth/email/resend","type":0,"val":"resend","end":""}],
    types: placeholder as Registry['auth.resend_verification']['types'],
  },
  'auth.forgot_password': {
    methods: ["POST"],
    pattern: '/api/v1/auth/password/forgot',
    tokens: [{"old":"/api/v1/auth/password/forgot","type":0,"val":"api","end":""},{"old":"/api/v1/auth/password/forgot","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/password/forgot","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/password/forgot","type":0,"val":"password","end":""},{"old":"/api/v1/auth/password/forgot","type":0,"val":"forgot","end":""}],
    types: placeholder as Registry['auth.forgot_password']['types'],
  },
  'auth.reset_password': {
    methods: ["POST"],
    pattern: '/api/v1/auth/password/reset',
    tokens: [{"old":"/api/v1/auth/password/reset","type":0,"val":"api","end":""},{"old":"/api/v1/auth/password/reset","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/password/reset","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/password/reset","type":0,"val":"password","end":""},{"old":"/api/v1/auth/password/reset","type":0,"val":"reset","end":""}],
    types: placeholder as Registry['auth.reset_password']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
