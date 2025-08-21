import type { Middleware, Reducer, UnknownAction } from 'redux'
import type {
  HistoryState,
  PartialUndoableActionsConfig,
  Persistence,
} from './types'
import createReducer from './reducer'
import createPersistenceMiddleware from './middleware'
import { getConfig, getConfigWithPersistence } from './config'

export function undoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig?: PartialUndoableActionsConfig,
): Reducer<HistoryState<State, Action>, Action> {
  const config = getConfig(customConfig)
  return createReducer(reducer, config)
}

export function persistedUndoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig: PartialUndoableActionsConfig & { persistence: Persistence },
): {
  reducer: Reducer<HistoryState<State, Action>, Action>
  middleware: Middleware
} {
  const config = getConfigWithPersistence(customConfig)
  const wrappedReducer = createReducer(reducer, config)
  const middleware = createPersistenceMiddleware(config)

  return { reducer: wrappedReducer, middleware }
}
