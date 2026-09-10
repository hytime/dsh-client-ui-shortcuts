import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PACKAGE_NAME, name } from '../src/invariant.js'
import { createProfileRegistry } from '../src/client/profiles/registry.js'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { name: string }

const profile = {
  id: 'alpha',
  label: 'shortcut.alpha.label',
  description: 'shortcut.alpha.description',
  bindings: [{
    command: 'activate' as const,
    scope: 'question' as const,
    key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false },
  }],
}

const STYLE_FILES = [
  'src/client/styles/Shortcuts.module.css',
  'src/client/styles/InteractionSurface.module.css',
] as const

/**
 * DSH alias tokens this package used to reference even though no supported DSH
 * generation declares them. A missing custom property resolves to the empty
 * value, so a typo silently drops borders, button fills, and state colors.
 */
const DEPRECATED_ALIAS_TOKENS = [
  'action-primary',
  'bg-warning',
  'bg-warning-light',
  'border-focus',
  'border-subtle',
  'border-warning',
  'label-error',
  'label-warning',
  'label-white',
  'text-danger',
  'text-on-primary',
  'text-primary',
  'text-secondary',
  'text-success',
  'text-warning',
]

/** Intersection of the `--dsw-alias-*` tokens declared by every supported DSH generation. */
const SUPPORTED_ALIAS_TOKENS = new Set([
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3', 'bg-mask-1', 'bg-mask-2', 'bg-mask-3',
  'bg-mask-drop', 'bg-mask-photo', 'bg-module-platform', 'bg-multi-select', 'bg-overlay',
  'bg-skeleton', 'border-inverted', 'border-inverted2', 'border-l1', 'border-l2',
  'border-l2-darkmode-thin', 'border-l3', 'border-l4', 'brand-primary', 'brand-primary-invert',
  'brand-primary-new-colorprimary-new-color', 'brand-text', 'button-contrast-fill',
  'button-elevated-fill', 'button-floating-fill', 'button-floating-hover',
  'button-ghost-active-border', 'button-ghost-active-fill', 'button-ghost-active-hover',
  'button-info-fill', 'button-info-hover', 'button-primary-dimmed', 'button-primary-fill',
  'button-primary-hover', 'button-tool-bar-fill', 'button-tool-bar-fill-invisible',
  'button-tool-bar-hover', 'interactive-bg-active', 'interactive-bg-hover',
  'interactive-bg-hover-accent', 'interactive-bg-hover-danger', 'interactive-bg-hover-solid',
  'label-caption', 'label-dimmed', 'label-primary', 'label-primary-bluish', 'label-primary-dimmed',
  'label-primary-foreground', 'label-primary-inverted', 'label-secondary', 'label-tertiary',
  'markdown-citation', 'markdown-code-block', 'markdown-code-block-banner',
  'markdown-code-segment-selected', 'markdown-code-segment-unselected', 'markdown-inline-code',
  'markdown-placeholder', 'markdown-tag', 'scrollbar-bg-l1', 'scrollbar-bg-l2',
  'scrollbar-hover-l1', 'scrollbar-hover-l2', 'state-business-primary', 'state-business-tertiary',
  'state-error-primary', 'state-error-secondary', 'state-success-primary',
  'state-success-secondary', 'state-success-tertiary', 'state-warn-label', 'state-warn-primary',
  'state-warn-secondary', 'state-warn-tertiary', 'toast-bg', 'tooltip-bg',
])

describe('shortcuts package invariant', () => {
  it('uses the manifest name for the invariant registration', () => {
    expect(PACKAGE_NAME).toBe(manifest.name)
    expect(name).toBe('dsh-client-ui-shortcuts-invariant')
  })

  it('documents the UI-only runtime observation boundary', () => {
    const source = readFileSync(resolve(root, 'src/invariant.ts'), 'utf8')
    expect(source).toContain('No runtime invariant: shortcuts is UI-only')
  })

  it('keeps exactly one active profile and falls back after disposal', () => {
    const registry = createProfileRegistry([profile])
    const dispose = registry.register({ ...profile, id: 'beta' })

    registry.setActive('beta')
    expect(registry.active().id).toBe('beta')
    expect(registry.list().filter((entry) => entry.id === registry.active().id)).toHaveLength(1)

    dispose()
    expect(registry.active().id).toBe('alpha')
    expect(registry.get('beta')).toBeUndefined()
  })

  it('makes owned profile observations disappear after disposal', () => {
    const registry = createProfileRegistry([profile])
    const dispose = registry.register({ ...profile, id: 'owned' })

    expect(registry.get('owned')).toBeDefined()
    dispose()
    expect(registry.get('owned')).toBeUndefined()
    expect(registry.list().map((entry) => entry.id)).toEqual(['alpha'])
  })

  it('models registry, slot, and locale disposal without test-only cleanup', () => {
    const owned = new Set(['profile', 'slot', 'locale'])
    const disposers = [
      () => owned.delete('profile'),
      () => owned.delete('slot'),
      () => owned.delete('locale'),
    ]

    for (const dispose of disposers) dispose()
    expect([...owned]).toEqual([])
  })

  it('keeps planning material and local agent instructions ignored without ignoring package sources', () => {
    const ignore = readFileSync(resolve(root, '.gitignore'), 'utf8')
    expect(ignore).toMatch(/\.superpowers\//)
    expect(ignore).toMatch(/docs\/superpowers\//)
    expect(ignore).toMatch(/(?:^|\n)AGENTS\.md/)
    expect(ignore).not.toMatch(/(?:^|\n)src\//)
    expect(ignore).not.toMatch(/(?:^|\n)tests\//)
    expect(ignore).not.toMatch(/(?:^|\n)README\.md/)
  })

  it('references only DSH alias tokens that exist in every supported DSH generation', () => {
    for (const file of STYLE_FILES) {
      const source = readFileSync(resolve(root, file), 'utf8')
      const used = new Set(source.match(/--dsw-alias-[a-z0-9-]+/g) ?? [])
      for (const token of used) {
        const tokenName = token.slice('--dsw-alias-'.length)
        expect(DEPRECATED_ALIAS_TOKENS, `${file} uses removed DSH token ${token}`).not.toContain(tokenName)
        expect(SUPPORTED_ALIAS_TOKENS.has(tokenName), `${file} uses unsupported DSH token ${token}`).toBe(true)
      }
    }
  })
})
