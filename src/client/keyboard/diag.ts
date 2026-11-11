/**
 * TEMPORARY diagnostics for the "recorded binding fires but nothing happens" report.
 * Records one compact line per session-navigation attempt into `localStorage` so the
 * evidence survives the devtools console and can be read off disk. Remove once the
 * live service shapes are confirmed.
 */
const KEY = 'dsh-shortcuts.diag'

export function recordDiag(label: string, payload: Record<string, unknown>): void {
  try {
    const line = `${label} ${JSON.stringify(payload)}`
    console.log('[dsh-shortcuts diag]', line)
    const previous = window.localStorage.getItem(KEY)
    const lines = previous === null || previous === '' ? [] : previous.split('\n')
    lines.push(line)
    window.localStorage.setItem(KEY, lines.slice(-40).join('\n'))
  } catch {
    /* diagnostics never disturb the command */
  }
}