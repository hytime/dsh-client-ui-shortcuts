import { describe, expect, it, vi } from 'vitest'
import { createGlobalActions } from '../src/client/actions/global-actions.js'

function services(overrides: Record<string, unknown> = {}) {
  const sessions = {
    list: { getSnapshot: () => ({ ids: ['s1', 's2'], byId: { s1: { id: 's1', blank: false }, s2: { id: 's2', blank: false } }, current: 's1' }) },
    open: vi.fn(), fork: vi.fn().mockResolvedValue('child'),
  }
  const workspaces = {
    list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1', sessionIds: ['s1'] }, { workspaceId: 'w2', sessionIds: ['s2'] }], archivedSessionIds: [] }) },
    startSession: vi.fn(),
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
    expect(createGlobalActions({ sessions: { list: services().sessions.list, open: undefined, fork: undefined } as never }).forkSession).toBeUndefined()
  })

  it('navigates sessions from the current DSH ids snapshot shape', () => {
    const d = services()
    d.sessions.list.getSnapshot = () => ({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1' },
        s2: { id: 's2' },
      },
      current: 's1',
    }) as never
    d.workspaces.list.getSnapshot = () => ({
      items: [{ workspaceId: 'w1', sessionIds: ['s1', 's2'] }],
      archivedSessionIds: [],
    }) as never
    const actions = createGlobalActions(d)

    expect(() => { actions.nextSession?.() }).not.toThrow()
    expect(d.sessions.open).toHaveBeenCalledWith('s2')
  })

  it('does not change selection when fork fails', async () => {
    const d = services()
    d.sessions.fork.mockRejectedValue(new Error('no'))
    const actions = createGlobalActions(d)
    actions.forkSession?.()
    await Promise.resolve()
    expect(d.sessions.open).not.toHaveBeenCalled()
  })

  it('navigates within the current workspace and skips blank sessions', () => {
    const d = services()
    d.sessions.list.getSnapshot = () => ({
      ids: ['s1', 'blank', 's2', 's3'],
      byId: {
        s1: { id: 's1', blank: false },
        blank: { id: 'blank', blank: true },
        s2: { id: 's2', blank: false },
        s3: { id: 's3', blank: false },
      },
      current: 's1',
    }) as never
    d.workspaces.list.getSnapshot = () => ({
      items: [
        { workspaceId: 'w1', sessionIds: ['s1', 'blank', 's2'] },
        { workspaceId: 'w2', sessionIds: ['s3'] },
      ],
      archivedSessionIds: [],
    }) as never
    const actions = createGlobalActions(d)

    actions.nextSession?.()
    expect(d.sessions.open).toHaveBeenCalledWith('s2')
    expect(d.sessions.open).not.toHaveBeenCalledWith('blank')

    d.sessions.open.mockClear()
    actions.nextWorkspace?.()
    expect(d.sessions.open).toHaveBeenCalledWith('s3')
  })

  it('does not navigate to a workspace without an existing non-blank session', () => {
    const d = services()
    d.sessions.list.getSnapshot = () => ({
      ids: ['s1'],
      byId: { s1: { id: 's1', blank: false } },
      current: 's1',
    }) as never
    d.workspaces.list.getSnapshot = () => ({
      items: [
        { workspaceId: 'w1', sessionIds: ['s1'] },
        { workspaceId: 'w2', sessionIds: ['blank'] },
      ],
      archivedSessionIds: [],
    }) as never
    const actions = createGlobalActions(d)

    actions.nextWorkspace?.()
    expect(d.sessions.open).not.toHaveBeenCalled()
  })

  it('allows start session without a sessions list', () => {
    const d = services()
    const actions = createGlobalActions({ workspaces: d.workspaces })
    actions.startSession?.()
    expect(d.workspaces.startSession).toHaveBeenCalledTimes(1)
  })

  it('uses dynamic session snapshots and resolves system theme from active scheme', () => {
    const d = services()
    let current = 's1'
    d.sessions.list.getSnapshot = () => {
      const ids = current === 's1' ? ['s1', 's2'] : ['s2', 's3']
      return { ids, byId: Object.fromEntries(ids.map(id => [id, { id }])), current }
    }
    d.workspaces.list.getSnapshot = () => ({
      items: [{ workspaceId: 'w1', sessionIds: current === 's1' ? ['s1', 's2'] : ['s2', 's3'] }],
      archivedSessionIds: [],
    })
    const actions = createGlobalActions(d)
    current = 's2'
    actions.nextSession?.()
    expect(d.sessions.open).toHaveBeenCalledWith('s3')
    d.theme.getTheme = () => ({ preference: 'system', active: { colorScheme: 'dark' } })
    actions.toggleTheme?.()
    expect(d.theme.setTheme).toHaveBeenCalledWith('light')
  })

  it('omits navigation when sessions cannot open', () => {
    const d = services()
    const actions = createGlobalActions({
      sessions: { list: d.sessions.list, open: undefined, fork: undefined } as never,
      workspaces: { list: d.workspaces.list } as never,
    })
    expect(actions.previousSession).toBeUndefined()
    expect(actions.nextSession).toBeUndefined()
    expect(actions.previousWorkspace).toBeUndefined()
    expect(actions.nextWorkspace).toBeUndefined()
  })

  it('does not expose settings or unavailable actions', () => {
    const actions = createGlobalActions({})
    expect(actions.openSettings).toBeUndefined()
    expect(actions.previousWorkspace).toBeUndefined()
  })

})
