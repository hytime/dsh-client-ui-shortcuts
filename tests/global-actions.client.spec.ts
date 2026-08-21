import { describe, expect, it, vi } from 'vitest'
import { createGlobalActions } from '../src/client/actions/global-actions.js'

function services(overrides: Record<string, unknown> = {}) {
  const sessions = {
    list: { getSnapshot: () => ({ ids: ['s1', 's2'], byId: { s1: { id: 's1' }, s2: { id: 's2' } }, current: 's1' }) },
    open: vi.fn(), fork: vi.fn().mockResolvedValue('child'),
  }
  const workspaces = {
    list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1', sessionIds: ['s1'] }, { workspaceId: 'w2', sessionIds: ['s2'] }] }) },
    startSession: vi.fn(), connectWorkspace: vi.fn().mockResolvedValue('s2'),
  }
  const theme = { getTheme: () => ({ preference: 'light' }), setTheme: vi.fn() }
  return { sessions, workspaces, theme, ...overrides }
}

describe('capability-aware global actions', () => {
  it('derives navigation and invokes exact service contracts', async () => {
    const d = services()
    const actions = createGlobalActions(d)
    actions.nextSession?.()
    actions.previousWorkspace?.()
    actions.startSession?.()
    actions.forkSession?.()
    actions.toggleTheme?.()
    await Promise.resolve()
    expect(d.sessions.open).toHaveBeenCalledWith('s2')
    expect(d.sessions.open).toHaveBeenCalledWith('child')
    expect(d.workspaces.startSession).toHaveBeenCalled()
    expect(d.sessions.fork).toHaveBeenCalledWith({ sessionId: 's1', increaseTitle: true })
    expect(d.theme.setTheme).toHaveBeenCalledWith('dark')
  })

  it('omits actions without optional capabilities or list state', () => {
    expect(createGlobalActions({}).startSession).toBeUndefined()
    expect(createGlobalActions({ sessions: { list: services().sessions.list } }).forkSession).toBeUndefined()
  })

  it('does not change selection when fork fails', async () => {
    const d = services()
    d.sessions.fork.mockRejectedValue(new Error('no'))
    const actions = createGlobalActions(d)
    actions.forkSession?.()
    await Promise.resolve()
    expect(d.sessions.open).not.toHaveBeenCalled()
  })
})
