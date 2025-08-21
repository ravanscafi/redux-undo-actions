import type { Middleware, Reducer, UnknownAction } from 'redux'
import type {
  HistoryState,
  PartialUndoableActionsConfig,
  Persistence,
} from './types'
import createHandler from './handler'
import { createPersistenceMiddleware } from './middleware'
import { getConfig, getConfigWithPersistence } from './config'

export function undoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig?: PartialUndoableActionsConfig,
): Reducer<HistoryState<State, Action>, Action> {
  const config = getConfig(customConfig)

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
        return reset(state)
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
  const config = getConfigWithPersistence(customConfig)
  const wrappedReducer = undoableActions(reducer, customConfig)
  const middleware = createPersistenceMiddleware(config)

  return { reducer: wrappedReducer, middleware }
}
