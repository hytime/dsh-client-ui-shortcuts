import { describe, expect, it, vi } from 'vitest'
import {
  NEXT_SESSION_COMMAND,
  PREV_SESSION_COMMAND,
  createNextSessionCommand,
  createPrevSessionCommand,
  mainViewSessionId,
  navigateSession,
  openSessionTarget,
  readSessionOrder,
} from '../src/client/keyboard/session-actions.js'
import type {
  SessionListSnapshotShape,
  SessionsNavFace,
  UiWorkspaceNavFace,
  WorkspacesNavFace,
} from '../src/client/keyboard/session-actions.js'

/**
 * Regression bench for the reported "recorded but never fires" bug: the plugin
 * guessed a `current`/`currentId` field that the real `sessions.list` snapshot
 * does not carry. The shipped snapshot identifies the main-view session only
 * through `byId[id].retainedBy.mainView > 0`, ordered lists through
 * `items[].sessionId`, and workspaces through `items[].sessionIds` +
 * `archivedSessionIds`. These stubs mirror those exact shapes.
 */

interface Row {
  id?: string
  sessionId?: string
  blank?: boolean
  updatedAt?: number
  retainedBy?: { mainView?: number }
}

/** A realistic `sessions` service: list snapshot carries no `current`, only `byId`/`items`. */
function sessionsService(
  items: Array<{ sessionId?: string; id?: string }>,
  byId: Record<string, Row>,
  extra: Partial<SessionsNavFace> = {},
): SessionsNavFace {
  const snap: SessionListSnapshotShape = { items, byId }
  return {
    list: { getSnapshot: () => snap },
    ...extra,
  }
}

function workspacesService(
  groups: string[][],
  archived: string[] = [],
): WorkspacesNavFace {
  return {
    list: {
      getSnapshot: () => ({
        items: groups.map(sessionIds => ({ sessionIds })),
        archivedSessionIds: archived,
      }),
    },
  }
}

function runHandled(command: { resolve: (context: never) => unknown }): void {
  const resolution = command.resolve({ modal: null, region: 'page', target: null } as never)
  expect((resolution as { status: string }).status).toBe('handled')
  ;(resolution as { run: () => void }).run()
}

describe('main-view session derivation from the official snapshot', () => {
  it('picks the row the snapshot reports as retained by mainView', () => {
    const snap: SessionListSnapshotShape = {
      items: [{ sessionId: 'a' }, { sessionId: 'b' }],
      byId: {
        a: { id: 'a', retainedBy: { mainView: 0 } },
        b: { id: 'b', retainedBy: { mainView: 1 } },
      },
    }
    expect(mainViewSessionId(snap)).toBe('b')
  })

  it('falls back to sessionId when the row keys the id that way', () => {
    const snap: SessionListSnapshotShape = { byId: { x: { sessionId: 'x', retainedBy: { mainView: 2 } } } }
    expect(mainViewSessionId(snap)).toBe('x')
  })

  it('returns undefined when no row is retained by the main view (the reported bug)', () => {
    // This is the exact shape that used to make the command a silent no-op:
    // there is no `current` field and no retained row, so the old code read
    // `snap.current ?? snap.currentId` and got undefined.
    const snap: SessionListSnapshotShape = {
      items: [{ sessionId: 'a' }],
      byId: { a: { id: 'a', updatedAt: 1 } },
    }
    expect(snap.current).toBeUndefined()
    expect(mainViewSessionId(snap)).toBeUndefined()
  })
})

describe('readSessionOrder', () => {
  it('reads item order in sidebar order and the current id from mainView retention', () => {
    const sessions = sessionsService(
      [{ sessionId: 's1' }, { sessionId: 's2' }, { sessionId: 's3' }],
      {
        s1: { id: 's1', updatedAt: 30, retainedBy: { mainView: 0 } },
        s2: { id: 's2', updatedAt: 20, retainedBy: { mainView: 1 } },
        s3: { id: 's3', updatedAt: 10 },
      },
    )
    expect(readSessionOrder(sessions)).toEqual({ ids: ['s1', 's2', 's3'], current: 's2' })
  })

  it('survives a throwing list service instead of crashing the dispatcher', () => {
    const sessions: SessionsNavFace = { list: { getSnapshot: () => { throw new Error('boom') } } }
    expect(readSessionOrder(sessions)).toEqual({ ids: [], current: undefined })
  })
})

describe('navigateSession walks the sidebar display order', () => {
  /** s1 newest → s3 oldest, all in one workspace, s2 retained by the main view. */
  function threeSessions(overrides: Partial<Row> = {}, current: string | undefined = 's2') {
    const byId: Record<string, Row> = {
      s1: { id: 's1', updatedAt: 30, retainedBy: { mainView: 0 } },
      s2: { id: 's2', updatedAt: 20, retainedBy: { mainView: current === 's2' ? 1 : 0 } },
      s3: { id: 's3', updatedAt: 10, retainedBy: { mainView: current === 's3' ? 1 : 0 } },
    }
    if (overrides) Object.assign(byId.s2, overrides)
    return {
      sessions: sessionsService([{ sessionId: 's1' }, { sessionId: 's2' }, { sessionId: 's3' }], byId),
      workspaces: workspacesService([['s1', 's2', 's3']]),
    }
  }

  it('steps to the previous and next session and wraps at both ends', () => {
    const { sessions, workspaces } = threeSessions()
    const open = vi.fn()
    const uiWorkspace: UiWorkspaceNavFace = { openSession: open }

    navigateSession(sessions, workspaces, uiWorkspace, -1)
    expect(open).toHaveBeenLastCalledWith('s1')
    navigateSession(sessions, workspaces, uiWorkspace, +1)
    expect(open).toHaveBeenLastCalledWith('s3')

    // Wrap: from the head, "previous" lands on the tail; from the tail, "next" lands on the head.
    const byId = sessions.list!.getSnapshot!().byId!
    byId.s1 = { ...byId.s1, retainedBy: { mainView: 1 } }
    byId.s2 = { ...byId.s2, retainedBy: { mainView: 0 } }
    navigateSession(sessions, workspaces, uiWorkspace, -1)
    expect(open).toHaveBeenLastCalledWith('s3')
    byId.s3 = { ...byId.s3, retainedBy: { mainView: 1 } }
    byId.s1 = { ...byId.s1, retainedBy: { mainView: 0 } }
    navigateSession(sessions, workspaces, uiWorkspace, +1)
    expect(open).toHaveBeenLastCalledWith('s1')
    expect(open).toHaveBeenCalledTimes(4)
  })

  it('never opens anything when no row is retained by the main view', () => {
    // Regression for the reported bug: the command must stay a harmless no-op
    // rather than erroring — and it must genuinely not call openSession.
    const sessions = sessionsService(
      [{ sessionId: 's1' }, { sessionId: 's2' }],
      { s1: { id: 's1', updatedAt: 30 }, s2: { id: 's2', updatedAt: 20 } },
    )
    const workspaces = workspacesService([['s1', 's2']])
    const open = vi.fn()
    navigateSession(sessions, workspaces, { openSession: open }, +1)
    navigateSession(sessions, workspaces, { openSession: open }, -1)
    expect(open).not.toHaveBeenCalled()
  })

  it('skips blank ("new session") rows', () => {
    const { sessions, workspaces } = threeSessions({ blank: true })
    const open = vi.fn()
    // Display order without the blank s2 is [s1, s3]; current is blank → sits before the head.
    navigateSession(sessions, workspaces, { openSession: open }, +1)
    expect(open).toHaveBeenLastCalledWith('s1')
    navigateSession(sessions, workspaces, { openSession: open }, -1)
    expect(open).toHaveBeenLastCalledWith('s3')
  })

  it('skips archived sessions', () => {
    const { sessions } = threeSessions()
    const workspaces = workspacesService([['s1', 's2', 's3']], ['s2'])
    const open = vi.fn()
    // s2 is archived and current: "next" from before-the-head opens the head s1.
    navigateSession(sessions, workspaces, { openSession: open }, +1)
    expect(open).toHaveBeenLastCalledWith('s1')
    navigateSession(sessions, workspaces, { openSession: open }, -1)
    expect(open).toHaveBeenLastCalledWith('s3')
  })

  it('appends ungrouped sessions after the workspace groups, by recency', () => {
    const sessions = sessionsService(
      [{ sessionId: 'g1' }, { sessionId: 'stray1' }, { sessionId: 'stray2' }],
      {
        g1: { id: 'g1', updatedAt: 50, retainedBy: { mainView: 1 } },
        stray1: { id: 'stray1', updatedAt: 90 },
        stray2: { id: 'stray2', updatedAt: 40 },
      },
    )
    const workspaces = workspacesService([['g1']])
    const open = vi.fn()
    // Order = [g1] (workspace) then [stray1, stray2] (recency desc). From g1, next = stray1.
    navigateSession(sessions, workspaces, { openSession: open }, +1)
    expect(open).toHaveBeenLastCalledWith('stray1')
  })

  it('falls back to the flat item order when the workspaces bundle is absent', () => {
    const sessions = sessionsService(
      [{ sessionId: 's1' }, { sessionId: 's2' }, { sessionId: 's3' }],
      {
        s1: { id: 's1', updatedAt: 30 },
        s2: { id: 's2', updatedAt: 20, retainedBy: { mainView: 1 } },
        s3: { id: 's3', updatedAt: 10 },
      },
    )
    const open = vi.fn()
    navigateSession(sessions, undefined, { openSession: open }, +1)
    expect(open).toHaveBeenLastCalledWith('s3')
  })
})

describe('openSessionTarget prefers the official uiWorkspace path', () => {
  it('routes through uiWorkspace.openSession', () => {
    const open = vi.fn()
    openSessionTarget({ openSession: open }, undefined, 's1')
    expect(open).toHaveBeenCalledWith('s1')
  })

  it('falls back to the controller open only when uiWorkspace is missing it', () => {
    const legacyOpen = vi.fn()
    openSessionTarget(undefined, { open: legacyOpen } as SessionsNavFace, 's1')
    expect(legacyOpen).toHaveBeenCalledWith('s1')
  })

  it('is a harmless no-op when neither service exposes an opener', () => {
    expect(() => openSessionTarget(undefined, undefined, 's1')).not.toThrow()
  })
})

describe('session step command shape', () => {
  it('carries the bracket defaults under every supported profile', () => {
    const prev = createPrevSessionCommand(() => 'p', undefined, undefined, undefined)
    const next = createNextSessionCommand(() => 'n', undefined, undefined, undefined)
    expect(prev.id).toBe(PREV_SESSION_COMMAND)
    expect(next.id).toBe(NEXT_SESSION_COMMAND)
    expect(prev.defaults['desktop:windows']).toEqual({ code: 'BracketLeft', modifiers: ['primary', 'shift'] })
    expect(next.defaults['desktop:windows']).toEqual({ code: 'BracketRight', modifiers: ['primary', 'shift'] })
    // Linux Web deliberately has no default (narrower official allowed set).
    expect(prev.defaults['web:linux']).toBeUndefined()
    expect(next.defaults['web:linux']).toBeUndefined()
  })
})
