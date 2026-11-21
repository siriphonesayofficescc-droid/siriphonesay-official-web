import { Component, type ReactNode } from 'react'

/** if the model cannot load, show the cover image and a message instead of breaking the page */
export default class ModelBoundary extends Component<{ fallback: ReactNode; resetKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: unknown) {
    console.warn('3D model could not be loaded', e)
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

