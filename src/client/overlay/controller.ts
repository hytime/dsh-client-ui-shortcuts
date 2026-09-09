/** Pure open-state controller for the shortcuts overlay. No ctx/live service. */
export interface OverlayControllerFace {
  isOpen(): boolean
  toggle(): void
  close(): void
  subscribe(listener: () => void): () => void
  /**
   * Open the overlay targeting an initial command to locate (e.g. from the
   * settings launch card). Idempotent when already open: only the requested
   * command is updated.
   */
  openWithFocus(command?: string): void
  /** The command the overlay should locate after opening; cleared on close. */
  focusCommand(): string | undefined
}

export class OverlayController implements OverlayControllerFace {
  private open = false
  private command: string | undefined
  private readonly listeners = new Set<() => void>()

  isOpen(): boolean { return this.open }

  toggle(): void {
    this.open = !this.open
    if (!this.open) this.command = undefined
    this.notify()
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.command = undefined
    this.notify()
  }

  openWithFocus(command?: string): void {
    this.command = command
    if (!this.open) {
      this.open = true
      this.notify()
    }
  }

  focusCommand(): string | undefined { return this.command }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }
}
