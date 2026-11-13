// Build without assuming a global `pnpm`: a `prepare` script runs on `pnpm pack` and on a
// Git-source install, where PATH may hold neither pnpm nor a matching Node. Each step is resolved
// to a real file path, so the build only depends on the installed toolchain.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')

function run(label, command, args) {
  process.stdout.write(`\n> ${label}\n`)
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
}

/** Resolve a package entry to a runnable file, bypassing strict `exports` maps. */
function binOf(pkg, entry) {
  return resolve(root, 'node_modules', pkg, entry)
}

// 1. Clean the previous output so a removed source cannot leave a stale declaration behind.
run('clean:lib', process.execPath, [resolve(root, 'scripts/clean-lib.mjs')])

// 2. Emit declarations (and the JS the bundler consumes) with the local TypeScript.
run('tsc', process.execPath, [binOf('typescript', 'bin/tsc')])

// 3. Bundle the Node and browser entries with the local tsdown.
run('tsdown', process.execPath, [binOf('tsdown', 'dist/run.mjs')])
