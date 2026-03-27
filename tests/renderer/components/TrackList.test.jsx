// tests/renderer/components/TrackList.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import TrackRow from '../../../src/renderer/components/TrackList/TrackRow.jsx'

const track = {
  id: 1, title: 'Strobe', artist: 'deadmau5',
  bpm: 128.0, key: '8A', duration: 402,
  hotcues: [{ slot: 'D', positionMs: 32000, colour: '#30D158' }],
  memoryCues: [],
}

describe('TrackRow', () => {
  it('renders title and artist', () => {
    render(<TrackRow track={track} selected={false} focused={false} onSelect={vi.fn()} onFocus={vi.fn()} />)
    expect(screen.getByText('Strobe')).toBeInTheDocument()
    expect(screen.getByText('deadmau5')).toBeInTheDocument()
  })

  it('calls onSelect when checkbox clicked', () => {
    const onSelect = vi.fn()
    render(<TrackRow track={track} selected={false} focused={false} onSelect={onSelect} onFocus={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
