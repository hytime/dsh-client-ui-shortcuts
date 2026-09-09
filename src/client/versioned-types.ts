/** Cross-version client types. DSH removed @deepseek-ai/dsh-client-runtime in 0.1.5-alpha.1;
 * every consumer import was type-only, so these local shapes keep one source tree valid on
 * rc.8 and 0.1.5-alpha.1 without version-branched imports.
 *
 * SessionId/WorkspaceId come from @deepseek-ai/dsh-client-connection (a stable peer in both
 * DSH generations), which re-exports the real nominal types from @deepseek-ai/dsh-session;
 * local brands would not satisfy the DSH slot registry's session-id contracts. */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-connection/client'
export type { SessionId, WorkspaceId }

/** Client-side sync state of one settings namespace. */
export interface SettingsScopeSnapshot<T> {
  readonly status: 'loading' | 'ready' | 'unavailable'
  readonly value: T | undefined
  readonly base: unknown
  readonly user: unknown
  readonly revision: number | undefined
  readonly writable: boolean
  readonly mode: 'host' | 'memory'
}

/** Reactive owner handle over one namespace's durable section. */
export interface SettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}

/** Minimal receipt shape returned by a legacy respond() carrier. */
export interface LegacyRespondReceipt {
  readonly accepted: boolean
  readonly reason?: string
}

/** Minimal question item shape consumed by the question flow. */
export interface QuestionItem {
  readonly id: string
  readonly question: string
  readonly detail?: string
  readonly multiSelect?: boolean
  readonly options?: readonly { readonly label: string; readonly value?: unknown; readonly description?: string }[]
}

/** Minimal PendingWait face; matches the members this package reads. */
export interface PendingWait<K extends string = string> {
  readonly kind: K
  readonly key: string
  readonly sessionId: SessionId
  readonly respond: (result: unknown) => Promise<LegacyRespondReceipt>
  readonly payload: K extends 'question'
    ? { readonly questions: readonly QuestionItem[] }
    : K extends 'approval'
      ? { readonly approvalId: string }
      : Record<string, never>
}

/** Cordis context with the optional client services this package touches. */
export type ClientContextLike = Context
