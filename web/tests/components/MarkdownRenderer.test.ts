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

    expect(wrapper.find('h1').text()).toBe('Hello World')
    expect(wrapper.find('strong').text()).toBe('test')
    expect(wrapper.html()).toContain('<p>This is a <strong>test</strong>.</p>')
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

  it('inherits typography styles from parent container', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: 'Paragraph text',
      },
    })

    const root = wrapper.get('.markdown-body')
    expect(root.attributes('style')).toContain('font-size: inherit')
    expect(root.attributes('style')).toContain('line-height: inherit')
  })
})
