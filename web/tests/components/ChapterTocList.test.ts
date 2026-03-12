import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChapterTocList from '@/components/shared/ChapterTocList.vue'

describe('ChapterTocList', () => {
  const chapters = [
    { id: 101, chapterIndex: 0, title: 'Chapter 1' },
    { id: 102, chapterIndex: 1, title: 'Chapter 2' },
    { id: 103, chapterIndex: 2, title: 'Chapter 3' },
  ]

  it('renders the chapter list and highlights the current chapter', () => {
    const wrapper = mount(ChapterTocList, {
      props: {
        chapters,
        currentIndex: 1,
      },
    })

    const buttons = wrapper.findAll('button')

    expect(buttons).toHaveLength(3)
    expect(buttons[1]!.text()).toBe('Chapter 2')
    expect(buttons[1]!.classes()).toContain('bg-primary/10')
    expect(buttons[0]!.classes()).toContain('hover:bg-muted')
  })

  it('emits the selected chapter index when a chapter is clicked', async () => {
    const wrapper = mount(ChapterTocList, {
      props: {
        chapters,
        currentIndex: 0,
      },
    })

    await wrapper.findAll('button')[2]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([[2]])
  })
})
