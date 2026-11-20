import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PhotoCutoutControls } from '../features/workspace/PhotoCutoutControls'

const cutout = vi.hoisted(() => vi.fn())
vi.mock('../lib/photo/cutout-image', () => ({ cutoutDataUrl: cutout }))

describe('background sensitivity', () => {
  it('uses the chosen tolerance and always recuts from the original', async () => {
    cutout.mockResolvedValueOnce('data:image/png;base64,CUT1').mockResolvedValueOnce('data:image/png;base64,CUT2')
    const original = { dataUrl: 'data:image/png;base64,ORIGINAL', widthPx: 20, heightPx: 20 }
    const onReplace = vi.fn()
    const view = render(<PhotoCutoutControls photo={original} onReplace={onReplace} />)
    fireEvent.click(screen.getByLabelText('Adjust background removal sensitivity'))
    fireEvent.change(screen.getByLabelText('Background removal sensitivity'), { target: { value: '60' } })
    fireEvent.click(screen.getByLabelText('Remove the background'))
    await waitFor(() => expect(onReplace).toHaveBeenCalledTimes(1))
    view.rerender(<PhotoCutoutControls photo={{ ...original, dataUrl: 'data:image/png;base64,CUT1' }} onReplace={onReplace} />)
    fireEvent.change(screen.getByLabelText('Background removal sensitivity'), { target: { value: '15' } })
    fireEvent.click(screen.getByLabelText('Remove the background'))
    await waitFor(() => expect(onReplace).toHaveBeenCalledTimes(2))
    expect(cutout).toHaveBeenNthCalledWith(1, original.dataUrl, { tolerance: 60 })
    expect(cutout).toHaveBeenNthCalledWith(2, original.dataUrl, { tolerance: 15 })
    fireEvent.click(screen.getByLabelText('Put the original photo back'))
    expect(onReplace).toHaveBeenLastCalledWith(original)
  })
})
