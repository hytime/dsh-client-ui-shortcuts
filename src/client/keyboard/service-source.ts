/**
 * A service handle that may be captured once, or resolved lazily at invoke time.
 *
 * Client plugins that read a service through `ctx.get(name)` without declaring it
 * in their `inject` are not gated on that service's activation: the plugin can
 * activate first and capture `undefined` forever. Resolving at invoke time makes
 * the command work no matter who activated first, and keeps the service optional
 * when a bundle really is absent.
 */
export type ServiceSource<T> = T | undefined | (() => T | undefined)

/** Resolve a lazily-provided service; never throws into the command dispatcher. */
export function resolveService<T>(source: ServiceSource<T>): T | undefined {
  if (typeof source === 'function') {
    try {
      return (source as () => T | undefined)()
    } catch {
      return undefined
    }
  }
  return source
}