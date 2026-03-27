// tests/renderer/components/RulesEditor.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import HotcuePicker from '../../../src/renderer/components/RightPanel/RulesEditor/HotcuePicker.jsx'

describe('HotcuePicker', () => {
  it('highlights the active slot', () => {
    render(<HotcuePicker value="D" onChange={() => {}} />)
    const dBtn = screen.getByText('D')
    expect(dBtn.closest('[data-active="true"]')).toBeTruthy()
  })

  it('calls onChange with clicked slot', () => {
    const onChange = vi.fn()
    render(<HotcuePicker value="D" onChange={onChange} />)
    fireEvent.click(screen.getByText('A'))
    expect(onChange).toHaveBeenCalledWith('A')
  })
})
