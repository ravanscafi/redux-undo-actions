import type { UnknownAction } from 'redux'
import type { ExportedHistory, StoragePersistor } from './types'

export const saveHistory = async <State, Action extends UnknownAction>(
  storage: StoragePersistor,
  storageKey: string,
  history: ExportedHistory<State, Action>,
) => {
  try {
    await storage.setItem(storageKey, JSON.stringify(history))
  } catch (e) {
    console.warn('failed to save history to storage', e)
  }
}

export const removeHistory = async (
  storage: StoragePersistor,
  storageKey: string,
) => {
  try {
    await storage.removeItem(storageKey)
  } catch (e) {
    console.warn('failed to remove history from storage', e)
  }
}

export const loadHistory = async <State, Action extends UnknownAction>(
  storage: StoragePersistor,
  storageKey: string,
): Promise<ExportedHistory<State, Action> | undefined> => {
  try {
    const raw = await storage.getItem(storageKey)
    if (!raw) {
      return undefined
    }

    return JSON.parse(raw) as ExportedHistory<State, Action>
  } catch (e) {
    console.warn('failed to load history from storage', e)
    return undefined
  }
}
