import { isAction, type Middleware, type UnknownAction } from 'redux'
import { type HistoryState, type PersistedUndoableActionsConfig } from './types'
import { isActionTracked } from './utils'
import { loadHistory, removeHistory, saveHistory } from './storage'
import { HISTORY_KEY } from './actions'

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

    const previousState = storeAPI.getState() as Record<
      string,
      HistoryState<unknown, UnknownAction>
    >
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
          type: config.internalActions.tracking,
          payload: true,
        })

        history.actions.forEach(({ action }) => {
          storeAPI.dispatch(action)
        })

        // todo: maybe we should track undo/redos and then there's no need to do this (or maybe just undos? - one more case of the actions "simplifier" - actions that null each other out)
        history.actions
          .filter(({ undone }) => undone)
          .forEach(() => {
            storeAPI.dispatch({ type: config.internalActions.undo })
          })

        if (!history.tracking) {
          storeAPI.dispatch({
            type: config.internalActions.tracking,
            payload: false,
          })
        }
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

    const currentState = storeAPI.getState() as Record<
      string,
      HistoryState<unknown, UnknownAction>
    >

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
