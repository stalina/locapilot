import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Select from './Select.vue'

describe('Select', () => {
  it('renders with label', () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [],
        label: 'Test Label',
      },
    })
    expect(wrapper.find('.select-label').text()).toBe('Test Label')
  })

  it('renders options correctly', () => {
    const options = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
    ]
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options,
      },
    })
    const selectOptions = wrapper.findAll('option')
    expect(selectOptions).toHaveLength(2)
    expect(selectOptions[0]!.text()).toBe('Option 1')
    expect(selectOptions[1]!.text()).toBe('Option 2')
  })

  it('renders placeholder when provided', () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [],
        placeholder: 'Select an option',
      },
    })
    const placeholderOption = wrapper.find('option[value=""]')
    expect(placeholderOption.exists()).toBe(true)
    expect(placeholderOption.text()).toBe('Select an option')
  })

  it('shows required mark when required', () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [],
        label: 'Required Field',
        required: true,
      },
    })
    expect(wrapper.find('.required-mark').exists()).toBe(true)
  })

  it('displays error message when error prop is set', () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [],
        error: 'This field is required',
      },
    })
    expect(wrapper.find('.select-error-message').text()).toBe('This field is required')
    expect(wrapper.find('.select-error').exists()).toBe(true)
  })

  it('emits update:modelValue on change', async () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [
          { value: '1', label: 'Option 1' },
          { value: '2', label: 'Option 2' },
        ],
      },
    })
    await wrapper.find('select').setValue('1')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['1'])
  })

  it('applies disabled state', () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [],
        disabled: true,
      },
    })
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.select-disabled').exists()).toBe(true)
  })

  it('disables specific options', () => {
    const options = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2', disabled: true },
    ]
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options,
      },
    })
    const selectOptions = wrapper.findAll('option')
    expect(selectOptions[0]!.attributes('disabled')).toBeUndefined()
    expect(selectOptions[1]!.attributes('disabled')).toBeDefined()
  })
})
