// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expandCollapsedWorkspace } from '../src/client/actions/workspace-expansion.js'

afterEach(() => { document.body.replaceChildren() })

function workspaceRow(title: string, expanded: boolean): HTMLElement {
  const row = document.createElement('div')
  row.setAttribute('role', 'treeitem')
  row.setAttribute('aria-expanded', String(expanded))
  row.append(document.createTextNode(`  ${title}  `))
  document.body.append(row)
  return row
}

describe('expandCollapsedWorkspace', () => {
  it('clicks the unique collapsed workspace row', () => {
    const row = workspaceRow('Beta Workspace', false)
    const click = vi.spyOn(row, 'click')
    expandCollapsedWorkspace(document, 'Beta   Workspace')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('does not click an already expanded row', () => {
    const row = workspaceRow('Beta', true)
    const click = vi.spyOn(row, 'click')
    expandCollapsedWorkspace(document, 'Beta')
    expect(click).not.toHaveBeenCalled()
  })

  it('does not click when the title is absent or ambiguous', () => {
    const first = workspaceRow('Beta', false)
    const second = workspaceRow('Beta', false)
    const firstClick = vi.spyOn(first, 'click')
    const secondClick = vi.spyOn(second, 'click')
    expandCollapsedWorkspace(document, 'Missing')
    expandCollapsedWorkspace(document, 'Beta')
    expect(firstClick).not.toHaveBeenCalled()
    expect(secondClick).not.toHaveBeenCalled()
  })
})
