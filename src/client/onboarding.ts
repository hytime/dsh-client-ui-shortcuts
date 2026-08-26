export const ONBOARDING_STORAGE_KEY = 'dsh-client-ui-shortcuts:onboarding:v1'
export const ONBOARDING_COMPLETED_VALUE = 'completed'

export interface OnboardingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function hasCompletedOnboarding(storage: OnboardingStorage | undefined): boolean {
  try {
    return storage?.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_COMPLETED_VALUE
  } catch {
    return false
  }
}

export function markOnboardingCompleted(storage: OnboardingStorage | undefined): void {
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_COMPLETED_VALUE)
  } catch {
    // Restricted browser storage must not block the settings card.
  }
}
