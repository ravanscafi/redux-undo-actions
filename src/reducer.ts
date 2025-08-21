import type { Middleware, Reducer, UnknownAction } from 'redux'
import {
  type HistoryState,
  initialUndoableActionsConfig,
  type PartialUndoableActionsConfig,
  type PersistedUndoableActionsConfig,
  type Persistence,
  type UndoableActionsConfig,
} from './types'
import createHandler from './handler'
import { createPersistenceMiddleware } from './middleware'

export function undoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig?: PartialUndoableActionsConfig,
): Reducer<HistoryState<State, Action>, Action> {
  const config: UndoableActionsConfig = {
    ...initialUndoableActionsConfig,
    ...customConfig,
    internalActions: {
      ...initialUndoableActionsConfig.internalActions,
      ...customConfig?.internalActions,
    },
  }

  const { initialState, undo, redo, reset, tracking, handle, trackAfter } =
    createHandler(reducer, config)

  return function (state, action) {
    if (!state) {
      return initialState
    }

    switch (action.type) {
      case config.internalActions.undo:
        return undo(state)
      case config.internalActions.redo:
        return redo(state)
      case config.internalActions.reset:
        return reset()
      case config.internalActions.tracking:
        return tracking(state, action)
      case config.trackAfterAction:
        return trackAfter(state, action)
      default:
        return handle(state, action)
    }
  }
}

export function persistedUndoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig: PartialUndoableActionsConfig & { persistence: Persistence },
): {
  reducer: Reducer<HistoryState<State, Action>, Action>
  middleware: Middleware
} {
  const config: PersistedUndoableActionsConfig = {
    ...initialUndoableActionsConfig,
    ...customConfig,
    internalActions: {
      ...initialUndoableActionsConfig.internalActions,
      ...customConfig.internalActions,
    },
  }
  const wrappedReducer = undoableActions(reducer, customConfig)
  const middleware = createPersistenceMiddleware(config)

  return { reducer: wrappedReducer, middleware }
}
