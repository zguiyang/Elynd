declare namespace NodeJS {
  interface ProcessEnv {
    /** Adonis API origin for Next server-side /api rewrites and logout BFF. Required. */
    API_INTERNAL_URL: string;
  }
}

export {};
