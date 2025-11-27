import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Alert from './Alert.vue'

describe('Alert', () => {
  it('renders with default props', () => {
    const wrapper = mount(Alert, {
      slots: {
        default: 'Test message',
      },
    })
    expect(wrapper.find('.alert').exists()).toBe(true)
    expect(wrapper.find('.alert-message').text()).toBe('Test message')
  })

  it('applies variant classes correctly', () => {
    const variants = ['success', 'info', 'warning', 'error'] as const
    variants.forEach((variant) => {
      const wrapper = mount(Alert, {
        props: { variant },
        slots: { default: 'Message' },
      })
      expect(wrapper.find(`.alert-${variant}`).exists()).toBe(true)
    })
  })

  it('displays title when provided', () => {
    const wrapper = mount(Alert, {
      props: { title: 'Alert Title' },
      slots: { default: 'Message' },
    })
    expect(wrapper.find('.alert-title').text()).toBe('Alert Title')
  })

  it('shows default icon for each variant', () => {
    const wrapper = mount(Alert, {
      props: { variant: 'success' },
      slots: { default: 'Message' },
    })
    expect(wrapper.find('.mdi-check-circle').exists()).toBe(true)
  })

  it('uses custom icon when provided', () => {
    const wrapper = mount(Alert, {
      props: { icon: 'star' },
      slots: { default: 'Message' },
    })
    expect(wrapper.find('.mdi-star').exists()).toBe(true)
  })

  it('shows dismiss button when dismissible', () => {
    const wrapper = mount(Alert, {
      props: { dismissible: true },
      slots: { default: 'Message' },
    })
    expect(wrapper.find('.alert-dismiss').exists()).toBe(true)
  })

  it('hides dismiss button by default', () => {
    const wrapper = mount(Alert, {
      slots: { default: 'Message' },
    })
    expect(wrapper.find('.alert-dismiss').exists()).toBe(false)
  })

  it('emits dismiss event when close button clicked', async () => {
    const wrapper = mount(Alert, {
      props: { dismissible: true },
      slots: { default: 'Message' },
    })
    await wrapper.find('.alert-dismiss').trigger('click')
    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mount(Alert, {
      slots: { default: 'Message' },
    })
    expect(wrapper.find('.alert').attributes('role')).toBe('alert')
  })
})
