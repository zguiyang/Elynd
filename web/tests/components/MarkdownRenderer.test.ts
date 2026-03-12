import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from '@/components/shared/MarkdownRenderer.vue'

describe('MarkdownRenderer', () => {
  it('renders markdown content as sanitized html', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: '# Hello World\n\nThis is a **test**.',
      },
    })

    expect(wrapper.html()).toContain('Hello World')
    expect(wrapper.html()).toContain('This is a')
    expect(wrapper.html()).toContain('test')
  })

  it('renders content without streaming by default', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: 'Plain text content',
      },
    })

    expect(wrapper.html()).toContain('Plain text content')
  })

  it('sanitizes dangerous html', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: '<script>alert("xss")</script><p>Safe content</p>',
      },
    })

    expect(wrapper.html()).not.toContain('<script>')
    expect(wrapper.html()).toContain('Safe content')
  })
})
