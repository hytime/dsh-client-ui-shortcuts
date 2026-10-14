/** Remove previous build output so renamed or deleted sources cannot leave stale artifacts
 * in the published `lib/` tree. tsdown runs with `clean: false` (its two faces share one
 * output directory), so nothing else prunes declarations of modules that no longer exist. */
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

rmSync(resolve(import.meta.dirname, '..', 'lib'), { recursive: true, force: true })
