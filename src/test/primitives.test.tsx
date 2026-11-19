import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Toggle } from '../components/ui/Toggle'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Save changes</Button>)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('locks and marks busy while loading (§2, §6)', () => {
    render(<Button loading>Export</Button>)
    const button = screen.getByRole('button', { name: /export/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('is disabled when explicitly disabled', () => {
    render(<Button disabled>Export</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('Input', () => {
  it('associates its label with the control (§3A)', () => {
    render(<Input label="Bleed" suffix="mm" inputMode="decimal" />)
    expect(screen.getByLabelText('Bleed')).toBeInTheDocument()
  })

  it('announces an error via role=alert', () => {
    render(<Input label="Width" error="Must be between 50 and 1200 mm" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Must be between')
    expect(screen.getByLabelText('Width')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Select', () => {
  it('renders labelled options', () => {
    render(
      <Select
        label="Trim size"
        options={[
          { value: 'a4', label: 'A4' },
          { value: 'letter', label: 'Letter' },
        ]}
      />,
    )
    expect(screen.getByLabelText('Trim size')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })
})

describe('Toggle', () => {
  it('exposes switch semantics and reports changes', () => {
    const onChange = vi.fn()
    render(<Toggle label="Reduced motion" checked={false} onChange={onChange} />)
    const control = screen.getByRole('switch', { name: 'Reduced motion' })
    expect(control).toHaveAttribute('aria-checked', 'false')
    control.click()
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Badge', () => {
  it('renders each semantic variant', () => {
    const { container } = render(
      <div>
        <Badge variant="neutral">Parsed</Badge>
        <Badge variant="accent">Edited</Badge>
        <Badge variant="warning">Low DPI</Badge>
        <Badge variant="danger">Failed</Badge>
      </div>,
    )
    expect(container.querySelectorAll('span')).toHaveLength(4)
  })
})
