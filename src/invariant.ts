interface InvariantInstaller {
  (ctx: unknown, fail: (message: string) => never): void | Promise<void>
}

interface InvariantContext {
  readonly invariants: {
    register(packageName: string, installer: InvariantInstaller): () => void
  }
}

export const PACKAGE_NAME = '@hytime/dsh-client-ui-shortcuts'

/** Cordis companion plugin name. */
export const name = 'client-ui-shortcuts-invariant'
/** Service required before the companion can register its package check. */
export const inject = ['invariants']

/**
 * No runtime invariant: task 1 only contributes package metadata; profile and
 * slot relations are checked after their registries are implemented.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration disposer.
 */
export const apply = (ctx: InvariantContext): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
