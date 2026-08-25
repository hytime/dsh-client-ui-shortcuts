import { CUSTOM_PROFILE_JSON_MAX_BYTES } from './custom-profile-json.js'

export interface ReadCustomProfileFileResult {
  readonly text: string
  readonly bytes: number
}

export async function readCustomProfileFile(file: Pick<File, 'size' | 'text'>): Promise<ReadCustomProfileFileResult> {
  if (file.size > CUSTOM_PROFILE_JSON_MAX_BYTES) throw new Error('custom profile JSON must not exceed 1 MiB')
  return { text: await file.text(), bytes: file.size }
}

export function downloadCustomProfileJson(
  document: Document,
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>,
  filename: string,
  text: string,
): void {
  const objectUrl = url.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    url.revokeObjectURL(objectUrl)
  }
}
