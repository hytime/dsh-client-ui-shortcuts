// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPasteClipboardCommand, pasteClipboardIntoComposer, PASTE_CLIPBOARD_COMMAND } from '../src/client/keyboard/paste-clipboard.js'

function composer(): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.dataset.phase = 'ready'
  document.body.append(el)
  return el
}

function stubClipboard(text: string | null, error = false): void {
  const readText = error
    ? vi.fn(() => Promise.reject(new Error('denied')))
    : vi.fn(() => Promise.resolve(text ?? ''))
  Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  // @ts-expect-error test-only delete of the stubbed clipboard
  delete navigator.clipboard
})

describe('paste-clipboard official command', () => {
  it('carries the dsh-shortcuts id, unbound defaults, and handled resolve', () => {
    const command = createPasteClipboardCommand(() => '粘贴剪贴板到输入框')
    expect(command.id).toBe(PASTE_CLIPBOARD_COMMAND)
    expect(command.defaults).toEqual({})
    expect(command.resolve({ modal: null, region: 'page', target: null }).status).toBe('handled')
  })

  it('appends clipboard text at the caret, fires input, and focuses the composer', async () => {
    stubClipboard('from clipboard')
    const el = composer()
    el.value = 'before after'
    el.setSelectionRange(7, 7) // caret after "before " (7 chars), before "after"
    await pasteClipboardIntoComposer()
    expect(el.value).toBe('before from clipboardafter')
    expect(el.selectionStart).toBe(21) // 7 + len('from clipboard')
    expect(document.activeElement).toBe(el)
    // Framework state machines need the input event, not just a value write.
    const seen = vi.fn()
    el.addEventListener('input', seen)
    await pasteClipboardIntoComposer()
    expect(seen).toHaveBeenCalled()
  })

  it('replaces the current selection instead of blindly appending', async () => {
    stubClipboard('X')
    const el = composer()
    el.value = 'abcdef'
    el.setSelectionRange(2, 5) // select "cde"
    await pasteClipboardIntoComposer()
    expect(el.value).toBe('abXf')
  })

  it('degrades to a no-op on clipboard failure, empty text, or missing composer', async () => {
    stubClipboard(null, true)
    const el = composer()
    el.value = 'untouched'
    await expect(pasteClipboardIntoComposer()).resolves.toBeUndefined()
    expect(el.value).toBe('untouched')

    stubClipboard('')
    await expect(pasteClipboardIntoComposer()).resolves.toBeUndefined()
    expect(el.value).toBe('untouched')

    el.remove()
    stubClipboard('orphan text')
    await expect(pasteClipboardIntoComposer()).resolves.toBeUndefined()
  })

  it('the run() path never throws into the dispatcher even when the clipboard rejects', () => {
    stubClipboard(null, true)
    const command = createPasteClipboardCommand(() => 'label')
    expect(() => command.resolve({ modal: null, region: 'page', target: null }).status === 'handled'
      && (command.resolve({ modal: null, region: 'page', target: null }) as { run: () => void }).run()).not.toThrow()
  })
})
