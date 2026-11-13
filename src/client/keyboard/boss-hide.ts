import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

export const BOSS_HIDE_COMMAND = 'dsh-shortcuts.bossHide' as ShortcutCommandId

/**
 * Boss-key hide half: tuck the desktop window into the tray.
 *
 * On Desktop the run() calls the shell-owned official bridge
 * `ctx.shortcuts.closeWindow()` (IPC dsh-desktop:shortcuts-close-window,
 * carrying the accepted config revision); the shell interprets that close as
 * "hide to tray" — the same account the tray click uses. On Web the bridge
 * rejects and the failure is swallowed: a browser tab has no window to hide.
 * A shortcuts service without closeWindow is also a graceful no-op.
 *
 * The wake half cannot live here — a browser plugin cannot reach the OS
 * window. Full one-key toggle (foreground → hide, hidden → wake) is the
 * companion OS-level hotkey's job (dsh-bosskey, surfaced in the settings
 * section); users without it wake the window from the tray.
 *
 * Unbound on every profile by default (an omitted profile is unbound per the
 * official contract): a boss key is deeply personal, and an auto-bound
 * modifier chord could hide the window on someone mid-keystroke. Record once
 * in DSH keyboard settings; it persists on that device.
 */
export function createBossHideCommand(label: () => string, hide: () => void): ShortcutCommand {
  return {
    id: BOSS_HIDE_COMMAND,
    label,
    aliases: ['boss key', 'hide window', 'boss hide'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: hide }),
  }
}

/**
 * Hide via the official closeWindow bridge, defensively: a service without
 * closeWindow (another plugin under the same service name, or absent) is a
 * no-op; a rejecting bridge (Web runtime) is swallowed. window.close() is
 * never called — the shell owns the close path end to end.
 */
interface CloseWindowBridge {
  closeWindow(): Promise<unknown>
}

export function bossHideViaBridge(bridges: Array<CloseWindowBridge | undefined>): void {
  for (const bridge of bridges) {
    const close = (bridge as Partial<CloseWindowBridge> | undefined)?.closeWindow
    if (typeof close !== 'function') continue
    try {
      const result = close.call(bridge)
      if (result instanceof Promise) result.catch(() => { /* Web runtime: nothing to hide */ })
      return // first bridge that accepted the call owns the hide
    } catch { /* try the next surface; nothing throws to the command dispatcher */ }
  }
}
