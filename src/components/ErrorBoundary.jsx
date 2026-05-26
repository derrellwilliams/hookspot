import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: 'var(--color-text-secondary)', fontFamily: 'sans-serif' }}>
          Something went wrong.{' '}
          <button onClick={() => this.setState({ error: null })} style={{ cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
