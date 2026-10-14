import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PACKAGE_NAME, name } from '../src/invariant.js'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { name: string }

const STYLE_FILES = [
  'src/client/styles/QuickPanel.module.css',
  'src/client/styles/InteractionSurface.module.css',
] as const

/** DSH alias tokens this package must never reference; a missing property resolves to empty. */
const DEPRECATED_ALIAS_TOKENS = [
  'action-primary', 'bg-warning', 'bg-warning-light', 'border-focus', 'border-subtle',
  'border-warning', 'label-error', 'label-warning', 'label-white', 'text-danger',
  'text-on-primary', 'text-primary', 'text-secondary', 'text-success', 'text-warning',
]

describe('shortcuts package invariant', () => {
  it('uses the manifest name for the invariant registration', () => {
    expect(PACKAGE_NAME).toBe(manifest.name)
    expect(name).toBe('dsh-client-ui-shortcuts-invariant')
  })
  it('documents the UI-only runtime observation boundary', () => {
    const source = readFileSync(resolve(root, 'src/invariant.ts'), 'utf8')
    expect(source).toContain('No runtime invariant: shortcuts is UI-only')
  })
  it('keeps planning material and local agent instructions ignored without ignoring package sources', () => {
    const ignore = readFileSync(resolve(root, '.gitignore'), 'utf8')
    expect(ignore).toMatch(/\.superpowers\//)
    expect(ignore).toMatch(/docs\/superpowers\//)
    expect(ignore).toMatch(/(?:^|\n)AGENTS\.md/)
    expect(ignore).not.toMatch(/(?:^|\n)src\//)
    expect(ignore).not.toMatch(/(?:^|\n)tests\//)
  })
  it('references no removed DSH alias token in its own styles', () => {
    for (const file of STYLE_FILES) {
      const source = readFileSync(resolve(root, file), 'utf8')
      for (const token of source.match(/--dsw-alias-[a-z0-9-]+/g) ?? []) {
        expect(DEPRECATED_ALIAS_TOKENS, `${file} uses removed DSH token ${token}`)
          .not.toContain(token.slice('--dsw-alias-'.length))
      }
    }
  })
})
