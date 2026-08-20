/**
 * Package-owned invariant companion for `@hytime/dsh-client-ui-shortcuts`.
 * @module @hytime/dsh-client-ui-shortcuts/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

export const PACKAGE_NAME = '@hytime/dsh-client-ui-shortcuts'

/** Cordis companion plugin name. */
export const name = 'client-ui-shortcuts-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: shortcuts is UI-only. Its profile registry, slot
 * entries, settings namespace, and locale registrations are owned by their
 * Client fibers; their disposers are observed in Client lifecycle tests, while
 * this companion has no cross-boundary state to inspect.
 */
export const install: InvariantInstaller = () => {
  // The UI-only boundary has no package-owned runtime relation to validate.
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
