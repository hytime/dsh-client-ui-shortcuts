function normalizedText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function expandCollapsedWorkspace(root: ParentNode, workspaceTitle: string): void {
  const title = normalizedText(workspaceTitle)
  const matches = [...root.querySelectorAll<HTMLElement>('[role="treeitem"][aria-expanded]')]
    .filter(row => normalizedText(row.innerText ?? '') === title)
  if (matches.length !== 1 || matches[0]?.getAttribute('aria-expanded') !== 'false') return
  matches[0].click()
}
