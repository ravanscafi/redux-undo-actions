import type { Reducer, UnknownAction } from 'redux'
import type { HistoryState, UndoableActionsConfig } from './types'
import { ActionTypes } from './actions'
import createHandler from './handler'

export default function undoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig?: Partial<UndoableActionsConfig>,
): Reducer<HistoryState<State, Action>, Action> {
  const config = getConfig(customConfig)

  const { initialState, undo, redo, hydrate, handle, trackAfter } =
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
      case config.hydrateActionType: {
        return hydrate(state, action)
      }
      case config.trackAfterActionType: {
        return trackAfter(state, action)
      }
      default:
        return handle(state, action)
    }
  }
}

export function getConfig(
  customConfig?: Partial<UndoableActionsConfig>,
): UndoableActionsConfig {
  return {
    undoActionType: ActionTypes.Undo,
    redoActionType: ActionTypes.Redo,
    hydrateActionType: ActionTypes.Hydrate,
    undoableActionTypes: [],
    trackedActionTypes: [],
    ...customConfig,
  }
}
