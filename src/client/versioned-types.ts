/** Cross-version client types. DSH removed @deepseek-ai/dsh-client-runtime in 0.1.5-alpha.1;
 * every consumer import was type-only, so these local shapes keep one source tree valid on
 * rc.8 and 0.1.5-alpha.1 without version-branched imports.
 *
 * SessionId comes from @deepseek-ai/dsh-client-connection (a stable peer in both DSH
 * generations), which re-exports the real nominal type from @deepseek-ai/dsh-session;
 * a local brand would not satisfy the DSH slot registry's session-id contracts.
 * WorkspaceId is a local branded string: 0.1.5-alpha.1's connection/client does not
 * export WorkspaceId, and this package only uses it in internal structure types and
 * as-casts, never across a typed DSH boundary. */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
export type { SessionId }
/** Local branded workspace id (runtime-carried as a plain string in both DSH generations). */
export type WorkspaceId = string & { readonly __dshWorkspaceId: unique symbol }

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

/** Locale capability this package probes instead of assuming.
 *
 * `addLanguage` — which is what makes an extra language *selectable* rather than merely
 * carrying a dictionary — landed after `0.1.1-rc.2`: `0.1.0-rc.8` and `0.1.1-rc.2` have no
 * such method, while `0.1.2-alpha.1` and `0.1.5-alpha.1` do. The three-argument `register`
 * overload exists in every generation, so dictionaries for those languages stay registerable
 * everywhere and simply go unused where the language cannot be selected. */
export interface ClientLocaleLike {
  readonly getSnapshot: () => { readonly locales: readonly { readonly id: string }[] }
  readonly addLanguage?: (input: { readonly id: string; readonly label: string; readonly fallback: string }) => () => void
}
