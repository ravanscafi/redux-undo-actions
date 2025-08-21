import { isAction, type Middleware, type UnknownAction } from 'redux'
import {
  type ExportedHistory,
  HISTORY_KEY,
  type HistoryState,
  type PersistedUndoableActionsConfig,
  type StoragePersistor,
} from './types'
import { exportHistory, isActionTracked } from './utils'

export const createPersistenceMiddleware = (
  config: PersistedUndoableActionsConfig,
): Middleware => {
  const { reducerKey, getStorageKey, storage, dispatchAfterMaybeLoading } =
    config.persistence
  const isTracked = (action: UnknownAction) => isActionTracked(config, action)
  let canUseStorage = true

  return (storeAPI) => (next) => async (action) => {
    if (!isAction(action)) {
      throw new Error(
        'Invalid action provided! Use custom middleware for async actions.',
      )
    }

    if (canUseStorage && action.type === config.resetActionType) {
      canUseStorage = false
      await removeHistory(
        storage,
        getStorageKey(() => storeAPI.getState()),
      )
      canUseStorage = true
      return next(action)
    }

    if (!isTracked(action)) {
      return next(action)
    }

    const previousState = storeAPI.getState() as Record<
      string,
      HistoryState<unknown, UnknownAction>
    >

    // not to future self: don't move this line above the previousState
    // assignment otherwise we will not have the previous state
    const returnValue = next(action)

    const currentState = storeAPI.getState() as Record<
      string,
      HistoryState<unknown, UnknownAction>
    >

    if (action.type === config.trackAfterActionType && canUseStorage) {
      canUseStorage = false
      const history = await loadHistory(
        storage,
        getStorageKey(() => storeAPI.getState()),
      )
      if (history !== undefined) {
        // todo: async hydration calling dispatch
        storeAPI.dispatch({ type: config.hydrateActionType, payload: history })
      }

      if (dispatchAfterMaybeLoading) {
        // experimental timeout to allow visual changes to be applied after hydration
        setTimeout(
          () => storeAPI.dispatch({ type: dispatchAfterMaybeLoading }),
          100,
        )
      }

      canUseStorage = true

      // halt from saving for no reason
      return returnValue
    }

    if (
      !isHistoryState(previousState, reducerKey) ||
      !isHistoryState(currentState, reducerKey)
    ) {
      throw new Error(
        'Unexpected state structure, make sure you provided the correct reducerKey: ' +
          reducerKey,
      )
    }

    const previousHistory = previousState[reducerKey][HISTORY_KEY]
    const currentHistory = currentState[reducerKey][HISTORY_KEY]

    if (
      canUseStorage &&
      (currentHistory.tracking !== previousHistory.tracking ||
        (currentHistory.actions.length > 0 &&
          currentHistory.actions !== previousHistory.actions))
    ) {
      canUseStorage = false
      const history = exportHistory(currentState[reducerKey])

      const storageKey = getStorageKey(() => storeAPI.getState())
      await saveHistory(storage, storageKey, history)
      canUseStorage = true
    }

    return returnValue
  }
}

const saveHistory = async <State, Action extends UnknownAction>(
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

const removeHistory = async (storage: StoragePersistor, storageKey: string) => {
  try {
    await storage.removeItem(storageKey)
  } catch (e) {
    console.warn('failed to remove history from storage', e)
  }
}

const loadHistory = async <State, Action extends UnknownAction>(
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

function isHistoryState(
  obj: unknown,
  reducerKey: string,
): obj is { [reducerKey]: HistoryState<unknown, UnknownAction> } {
  if (typeof obj !== 'object' || obj === null || !(reducerKey in obj)) {
    return false
  }

  const reducerValue = (obj as Record<string, unknown>)[reducerKey]

  return (
    typeof reducerValue === 'object' &&
    reducerValue !== null &&
    HISTORY_KEY in reducerValue
  )
}
