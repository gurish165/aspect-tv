import { useSyncExternalStore } from 'react'
import {
  defaultSettings,
  fromLegacySearch,
  merge,
  sanitize,
  type BoothPatch,
  type BoothSettings,
} from './booth'

// One settings object shared by the TV window and the admin window. In the desktop app the main
// process owns it and broadcasts every change; in a browser, tabs share it through localStorage.

const STORAGE_KEY: string = 'aspect-booth-settings-v1'

let current: BoothSettings = defaultSettings()
const listeners: Set<() => void> = new Set()

function publish(next: BoothSettings): void {
  current = next
  for (const listener of listeners) listener()
}

function readBrowserSettings(): BoothSettings {
  try {
    const stored: string | null = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return sanitize(JSON.parse(stored))
  } catch {
    // Fall back to the defaults.
  }
  // Older bookmarks kept display settings in the URL.
  return fromLegacySearch(window.location.search)
}

function writeBrowserSettings(settings: BoothSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Settings still apply to this tab.
  }
}

/** Loads the saved settings and starts listening for changes from the other window. */
export async function loadSettings(): Promise<void> {
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  if (desktop) {
    desktop.onSettings((settings: unknown): void => publish(sanitize(settings)))
    const saved: { settings: unknown; legacySearch: string } = await desktop.getSettings()
    if (saved.settings) {
      publish(sanitize(saved.settings))
    } else {
      // First launch of this version: carry over the logo settings and save the full set.
      publish(fromLegacySearch(saved.legacySearch ?? ''))
      desktop.updateSettings(current)
    }
    return
  }
  publish(readBrowserSettings())
  window.addEventListener('storage', (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) publish(readBrowserSettings())
  })
}

export function getSettings(): BoothSettings {
  return current
}

export function updateSettings(patch: BoothPatch): void {
  publish(merge(current, patch))
  const desktop: Window['aspectDesktop'] = window.aspectDesktop
  if (desktop) desktop.updateSettings(patch)
  else writeBrowserSettings(current)
}

export function resetSettings(section: keyof BoothSettings): void {
  updateSettings({ [section]: defaultSettings()[section] })
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

export function useBoothSettings(): BoothSettings {
  return useSyncExternalStore(subscribeSettings, getSettings)
}
