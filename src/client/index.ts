/** Browser context is structurally supplied by the DSH Client runner. */
type ClientContext = unknown

/** Client services are added as each later task mounts its slot contribution. */
export const inject = [] as const

/**
 * Empty browser plugin until the profile and slot contributions are mounted.
 * @param _ctx - browser Cordis context reserved for later tasks.
 */
export function apply(_ctx: ClientContext): void {}
