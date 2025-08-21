import type { Middleware, Reducer, UnknownAction } from 'redux'
import {
  type HistoryState,
  initialUndoableActionsConfig,
  type PersistedUndoableActionsConfig,
  type Persistence,
  type UndoableActionsConfig,
} from './types'
import createHandler from './handler'
import { createPersistenceMiddleware } from './middleware'

export function undoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig?: Partial<UndoableActionsConfig>,
): Reducer<HistoryState<State, Action>, Action> {
  const config: UndoableActionsConfig = {
    ...initialUndoableActionsConfig,
    ...customConfig,
  }

  const { initialState, undo, redo, reset, hydrate, handle, trackAfter } =
    createHandler(reducer, config)

  return function (state, action) {
    if (!state) {
      return initialState
    }

    switch (action.type) {
      case config.undoActionType:
        return undo(state)
      case config.redoActionType:
        return redo(state)
      case config.resetActionType:
        return reset()
      case config.hydrateActionType:
        return hydrate(state, action)
      case config.trackAfterActionType:
        return trackAfter(state, action)
      default:
        return handle(state, action)
    }
  }
}

export function persistedUndoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig: Partial<UndoableActionsConfig> & { persistence: Persistence },
): {
  reducer: Reducer<HistoryState<State, Action>, Action>
  middleware: Middleware
} {
  const config: PersistedUndoableActionsConfig = {
    ...initialUndoableActionsConfig,
    ...customConfig,
  }
  const wrappedReducer = undoableActions(reducer, customConfig)
  const middleware = createPersistenceMiddleware(config)

  return { reducer: wrappedReducer, middleware }
}
