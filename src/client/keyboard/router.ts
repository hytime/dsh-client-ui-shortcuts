import type { KeyInput } from '../contract/keyboard.js'
import type { GlobalActions } from '../actions/global-actions.js'
import type { ShortcutProfile } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import { createKeyResolver } from './resolve.js'
import { normalizeKeyboardEvent } from './normalize.js'

export const GLOBAL_SEQUENCE_TIMEOUT_MS = 650

type RouterWindow = Pick<Window, 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout'>
type RouterEvent = KeyboardEvent & { readonly target: EventTarget | null; readonly stopImmediatePropagation?: () => void }

const CAPTURE_OPTIONS = { capture: true } as const

export interface GlobalKeyboardRouterOptions {
  readonly getProfile: () => ShortcutProfile
  readonly getActions: () => GlobalActions
  readonly isInteractionPending?: () => boolean
  readonly platform?: ShortcutPlatform
  readonly timeoutMs?: number
}

export function createGlobalKeyboardRouter(target: RouterWindow, options: GlobalKeyboardRouterOptions): () => void {
  const resolver = createKeyResolver()
  const platform = options.platform ?? 'linux'
  let timer: ReturnType<Window['setTimeout']> | undefined
  const reset = (): void => {
    resolver.reset()
    if (timer !== undefined) target.clearTimeout(timer)
    timer = undefined
  }
  const onKeyDown = (event: RouterEvent): void => {
    if (event.isComposing || event.keyCode === 229 || event.repeat) return
    if (options.isInteractionPending?.() && (event.key === 'Enter' || event.key === 'Escape')) {
      reset()
      return
    }
    const input = normalizeKeyboardEvent(event)
    const decision = resolver.resolve(options.getProfile(), 'global', input, platform)
    if (decision.kind === 'command') {
      const action = options.getActions()[decision.command as keyof GlobalActions]
      reset()
      if (action === undefined) return
      consume(event)
      action()
      return
    }
    if (isPrefix(options.getProfile(), input, platform)) {
      consume(event)
      if (timer !== undefined) target.clearTimeout(timer)
      timer = target.setTimeout(reset, options.timeoutMs ?? GLOBAL_SEQUENCE_TIMEOUT_MS)
      return
    }
    if (isGuardedTarget(event.target)) return
  }
  target.addEventListener('keydown', onKeyDown as EventListener, CAPTURE_OPTIONS)
  return () => { reset(); target.removeEventListener('keydown', onKeyDown as EventListener, CAPTURE_OPTIONS) }
}

function consume(event: RouterEvent): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation?.()
}

function isPrefix(profile: ShortcutProfile, input: KeyInput, platform: ShortcutPlatform): boolean {
  return profile.bindings.some(binding => {
    if (binding.scope !== 'global') return false
    const sequences = binding.sequences ?? (binding.sequence ? [binding.sequence] : [])
    const stroke = sequences.find(sequence => sequence.length === 2)?.[0]
    if (stroke === undefined || stroke.key !== input.key) return false
    if ('modifiers' in stroke) {
      if (stroke.modifiers.includes('Ctrl') && platform === 'mac') return false
      if (stroke.modifiers.includes('Meta') && platform !== 'mac') return false
      const modifierMatches = stroke.modifiers.includes('Mod')
        ? platform === 'mac' ? input.meta && !input.ctrl : input.ctrl && !input.meta
        : stroke.modifiers.includes('Ctrl') === input.ctrl && stroke.modifiers.includes('Meta') === input.meta
      return modifierMatches
        && stroke.modifiers.includes('Alt') === input.alt
        && stroke.modifiers.includes('Shift') === input.shift
    }
    if ((platform === 'mac' && stroke.ctrl) || (platform !== 'mac' && stroke.meta)) return false
    return stroke.alt === input.alt && stroke.ctrl === input.ctrl && stroke.meta === input.meta && stroke.shift === input.shift
  })
}

function isGuardedTarget(target: EventTarget | null): boolean {
  let node = target as HTMLElement | null
  while (node !== null) {
    const tag = node.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable) return true
    node = node.parentElement
  }
  return false
}
