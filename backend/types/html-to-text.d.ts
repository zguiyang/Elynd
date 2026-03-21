declare module 'html-to-text' {
  export interface ConvertOptions {
    wordwrap?: boolean
    preserveNewlines?: boolean
  }

  export function convert(html: string, options?: ConvertOptions): string
}
