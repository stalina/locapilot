import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Spinner from './Spinner.vue'

describe('Spinner', () => {
  it('renders correctly', () => {
    const wrapper = mount(Spinner)
    expect(wrapper.find('.spinner').exists()).toBe(true)
    expect(wrapper.find('.spinner-svg').exists()).toBe(true)
  })

  it('applies size classes correctly', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const
    sizes.forEach((size) => {
      const wrapper = mount(Spinner, { props: { size } })
      expect(wrapper.find(`.spinner-${size}`).exists()).toBe(true)
    })
  })

  it('applies default size when not specified', () => {
    const wrapper = mount(Spinner)
    expect(wrapper.find('.spinner-md').exists()).toBe(true)
  })

  it('applies variant classes correctly', () => {
    const variants = ['primary', 'white', 'gray'] as const
    variants.forEach((variant) => {
      const wrapper = mount(Spinner, { props: { variant } })
      expect(wrapper.find(`.spinner-${variant}`).exists()).toBe(true)
    })
  })

  it('has accessibility attributes', () => {
    const wrapper = mount(Spinner)
    const spinner = wrapper.find('.spinner')
    expect(spinner.attributes('role')).toBe('status')
    expect(spinner.attributes('aria-live')).toBe('polite')
  })

  it('includes screen reader text', () => {
    const wrapper = mount(Spinner)
    expect(wrapper.find('.sr-only').text()).toBe('Chargement...')
  })
})
