import { isAction, type Middleware, type UnknownAction } from 'redux'
import type { History, PersistedUndoableActionsConfig } from './types'
import { isActionTracked } from './utils'
import { loadHistory, removeHistory, saveHistory } from './storage'
import { HISTORY_KEY } from './actions'

export default function createPersistenceMiddleware(
  config: PersistedUndoableActionsConfig,
): Middleware {
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

    const previousState: unknown = storeAPI.getState()
    // after grabbing the previous state, we can call next
    const returnValue = next(action)

    if (canUseStorage && action.type === config.internalActions.reset) {
      canUseStorage = false
      await removeHistory(
        storage,
        getStorageKey(() => previousState),
      )
      canUseStorage = true

      // no need to continue
      return returnValue
    }

    if (canUseStorage && action.type === config.trackAfterAction) {
      canUseStorage = false
      const history = await loadHistory(
        storage,
        getStorageKey(() => storeAPI.getState()),
      )
      if (history !== undefined) {
        storeAPI.dispatch({
          type: config.internalActions.hydrate,
          payload: history,
        })
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

    if (!isTracked(action) || !canUseStorage) {
      return returnValue
    }

    const currentState: unknown = storeAPI.getState()

    const previousHistory = getHistoryState(previousState, reducerKey)
    const currentHistory = getHistoryState(currentState, reducerKey)

    if (
      currentHistory.tracking !== previousHistory.tracking ||
      (currentHistory.actions.length > 0 &&
        currentHistory.actions !== previousHistory.actions)
    ) {
      canUseStorage = false

      const storageKey = getStorageKey(() => storeAPI.getState())
      const history = {
        actions: currentHistory.actions,
        tracking: currentHistory.tracking,
      }
      await saveHistory(storage, storageKey, history)
      canUseStorage = true
    }

    return returnValue
  }
}

function getHistoryState(
  obj: unknown,
  reducerKey: string | false,
): History<unknown, UnknownAction> {
  const error = new Error(
    'Unexpected state structure, make sure you provided the correct reducerKey: ' +
      (reducerKey || 'false'),
  )

  if (typeof obj !== 'object' || obj === null) {
    throw error
  }

  if (reducerKey === false && HISTORY_KEY in obj) {
    return obj[HISTORY_KEY] as History<unknown, UnknownAction>
  }

  if (reducerKey === false || !(reducerKey in obj)) {
    throw error
  }

  const reducerValue = (obj as Record<string, unknown>)[reducerKey]

  if (
    typeof reducerValue === 'object' &&
    reducerValue !== null &&
    HISTORY_KEY in reducerValue
  ) {
    return reducerValue[HISTORY_KEY] as History<unknown, UnknownAction>
  }

  throw error
}
