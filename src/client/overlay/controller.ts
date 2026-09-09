/** Pure open-state controller for the shortcuts overlay. No ctx/live service. */
export interface OverlayControllerFace {
  isOpen(): boolean
  toggle(): void
  close(): void
  subscribe(listener: () => void): () => void
}

export class OverlayController implements OverlayControllerFace {
  private open = false
  private readonly listeners = new Set<() => void>()

  isOpen(): boolean { return this.open }

  toggle(): void {
    this.open = !this.open
    this.notify()
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }
}
