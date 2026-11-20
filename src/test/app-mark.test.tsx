import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TopBar } from '../components/layout/TopBar'
import { APP_NAME } from '../config/brand'

/**
 * One mark, and it is the app's own.
 *
 * The header showed a red square with a letter `C` in it beside the wordmark — a stand-in
 * that matched neither the favicon nor the installed icon. The real artwork is
 * `public/favicon.svg`, so that is what is rendered here, and the wordmark stays as the
 * single piece of text.
 */
const renderBar = () =>
  render(
    <TopBar
      scale={1}
      fitting
      paper={{ widthMm: 210, heightMm: 297 }}
      sheetCount={1}
      onStep={() => undefined}
      onFit={() => undefined}
      onOpenSettings={() => undefined}
      onExportCurrent={() => undefined}
      onExportAll={() => undefined}
      hasMoreThanOneSheet={false}
      exporting={false}
      hasBatch={false}
    />,
  )

describe('the header', () => {
  it('shows the app icon, not a lettered badge', () => {
    const { container } = renderBar()
    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    expect(image?.getAttribute('src')).toBe('/favicon.svg')
    // Decorative: the wordmark beside it already names the app.
    expect(image?.getAttribute('alt')).toBe('')
  })

  it('names the app exactly once', () => {
    renderBar()
    const marks = screen.getAllByText(APP_NAME)
    expect(marks).toHaveLength(1)
    // The old badge was a lone capital. If it returns it will show up as its own node.
    expect(screen.queryByText(/^C$/)).not.toBeInTheDocument()
  })
})
