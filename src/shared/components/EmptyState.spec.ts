import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from './EmptyState.vue'

describe('EmptyState', () => {
  it('renders with default props', () => {
    const wrapper = mount(EmptyState)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.empty-state-title').text()).toBe('Aucun élément')
  })

  it('displays custom title', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'Custom Title' },
    })
    expect(wrapper.find('.empty-state-title').text()).toBe('Custom Title')
  })

  it('displays description when provided', () => {
    const wrapper = mount(EmptyState, {
      props: { description: 'Test description' },
    })
    expect(wrapper.find('.empty-state-description').text()).toBe('Test description')
  })

  it('hides description when not provided', () => {
    const wrapper = mount(EmptyState)
    expect(wrapper.find('.empty-state-description').exists()).toBe(false)
  })

  it('displays custom icon', () => {
    const wrapper = mount(EmptyState, {
      props: { icon: 'star' },
    })
    expect(wrapper.find('.mdi-star').exists()).toBe(true)
  })

  it('displays default icon when not specified', () => {
    const wrapper = mount(EmptyState)
    expect(wrapper.find('.mdi-inbox').exists()).toBe(true)
  })

  it('shows action button when actionLabel provided', () => {
    const wrapper = mount(EmptyState, {
      props: { actionLabel: 'Add Item' },
    })
    const button = wrapper.find('.empty-state-action')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('Add Item')
  })

  it('hides action button when actionLabel not provided', () => {
    const wrapper = mount(EmptyState)
    expect(wrapper.find('.empty-state-action').exists()).toBe(false)
  })

  it('emits action event when button clicked', async () => {
    const wrapper = mount(EmptyState, {
      props: { actionLabel: 'Add' },
    })
    await wrapper.find('.empty-state-action').trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
  })

  it('renders slot content', () => {
    const wrapper = mount(EmptyState, {
      slots: {
        default: '<p class="custom-content">Custom content</p>',
      },
    })
    expect(wrapper.find('.custom-content').exists()).toBe(true)
    expect(wrapper.find('.custom-content').text()).toBe('Custom content')
  })
})
