/**
 * Functional groups for the plugin's own official commands, in the style of
 * Qoder's keyboard-shortcuts documentation (General / Chat / Diff View …):
 * commands are grouped by what they do for the workflow, not by which layer
 * registered them. DSH's own commands keep their positions; only this
 * plugin's ids carry a group here.
 */
export type CommandGroup =
  | 'general'      // panel summon and settings-adjacent commands
  | 'input'        // composer-centric actions
  | 'sessions'     // session lifecycle and navigation
  | 'view'         // layout, panels, theme, scrolling
  | 'bosskey'      // boss-key family

const GROUP_BY_COMMAND: Record<string, CommandGroup> = {
  'dsh-shortcuts.open': 'general',
  'dsh-shortcuts.composerFocus': 'input',
  'dsh-shortcuts.pasteClipboard': 'input',
  'dsh-shortcuts.prevSession': 'sessions',
  'dsh-shortcuts.nextSession': 'sessions',
  'dsh-shortcuts.toggleTheme': 'view',
  'dsh-shortcuts.scrollTop': 'view',
  'dsh-shortcuts.scrollBottom': 'view',
  'dsh-shortcuts.bossHide': 'bosskey',
}

export function groupOf(commandId: string): CommandGroup | undefined {
  return GROUP_BY_COMMAND[commandId]
}

/** Display order of groups in the quick panel; unknown groups sink last. */
export const GROUP_ORDER: readonly CommandGroup[] = ['general', 'input', 'sessions', 'view', 'bosskey']

export interface GroupableCommand { id: string }

/** Sort commands into groups, keeping each group's registration order. */
export function groupCommands<T extends { id: string }>(commands: readonly T[]): Array<{ group: CommandGroup | null; commands: T[] }> {
  const buckets = new Map<CommandGroup, T[]>()
  const ungrouped: T[] = []
  for (const command of commands) {
    const group = groupOf(command.id)
    if (group === undefined) { ungrouped.push(command); continue }
    const bucket = buckets.get(group) ?? []
    bucket.push(command)
    buckets.set(group, bucket)
  }
  const sections: Array<{ group: CommandGroup | null; commands: T[] }> = []
  for (const group of GROUP_ORDER) {
    const bucket = buckets.get(group)
    if (bucket !== undefined && bucket.length > 0) sections.push({ group, commands: bucket })
  }
  if (buckets.size > 0 && ungrouped.length > 0) sections.push({ group: null, commands: ungrouped })
  return sections
}
