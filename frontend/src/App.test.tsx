import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the WorkMesh application shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Your company workspace, connected.' }),
    ).toBeInTheDocument()
  })
})
