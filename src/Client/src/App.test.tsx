import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('starter shell', () => {
  it('labels the portal as a foundation preview', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: 'Secure agent operations, one step at a time.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Foundation preview')
    expect(
      screen.getByText(/authentication, ACS enforcement, and ticket operations/i),
    ).toBeInTheDocument()
  })
})
