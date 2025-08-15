import type { Reducer, UnknownAction } from 'redux'

import { ActionTypes } from './actions'
import type { History, HistoryState, UndoableActionsConfig } from './types'
import { deepEqual } from './utils'

export default function undoableActions<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  customConfig?: Partial<UndoableActionsConfig>,
): Reducer<HistoryState<State, Action>, Action> {
  const config = {
    undoActionType: ActionTypes.Undo,
    redoActionType: ActionTypes.Redo,
    hydrateActionType: ActionTypes.Hydrate,
    undoableActionTypes: [],
    ...customConfig,
  }
  const originalInitialState = reducer(undefined, {} as Action)
  const initialState = {
    present: originalInitialState,
    history: {
      tracking: config.trackAfterActionType === undefined,
      past: [],
      future: [],
      snapshot: originalInitialState,
    },
    canUndo: false,
    canRedo: false,
  }
  return function (state, action) {
    if (!state) {
      return initialState
    }

    switch (action.type) {
      case config.undoActionType:
        return undo(reducer, config, state)
      case config.redoActionType:
        return redo(reducer, config, state)
      case config.hydrateActionType: {
        return hydrate(reducer, config, state, action, initialState)
      }
      case config.trackAfterActionType: {
        return trackAfter(reducer, config, state, action, initialState)
      }
      default:
        return handle(reducer, config, state, action)
    }
  }
}

function undo<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const { history } = state
  const { past, future } = history

  if (past.length === 0) {
    return state
  }

  const lastUndoableIndex =
    config.undoableActionTypes.length === 0
      ? past.length - 1
      : past.findLastIndex((a) => config.undoableActionTypes.includes(a.type))

  if (lastUndoableIndex === -1) {
    return state
  }

  const newPast = past.toSpliced(lastUndoableIndex, 1)
  const undoneAction = past[lastUndoableIndex]
  const replayedState = newPast.reduce(
    (accState, a) => reducer(accState, a),
    history.snapshot,
  )

  return {
    history: {
      ...history,
      past: newPast,
      future: [
        {
          action: undoneAction,
          index: lastUndoableIndex,
        },
        ...future,
      ],
    },
    present: replayedState,
    canUndo: canUndo(config, newPast),
    canRedo: true,
  }
}

function redo<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const { history, present } = state
  const { past, future } = history

  if (future.length === 0) {
    return state
  }

  const [redoAction, ...newFuture] = future
  let newPast
  let newPresent

  if (redoAction.index === past.length) {
    newPast = [...past, redoAction.action]
    newPresent = reducer(present, redoAction.action)
  } else {
    newPast = past.toSpliced(redoAction.index, 0, redoAction.action)
    newPresent = newPast.reduce(
      (accState, a) => reducer(accState, a),
      history.snapshot,
    )
  }

  return {
    history: {
      ...history,
      past: [...past, redoAction.action],
      future: newFuture,
    },
    present: newPresent,
    canUndo: canUndo(config, newPast),
    canRedo: newFuture.length > 0,
  }
}

function hydrate<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  action: Action,
  initialState: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const { payload } = action
  const {
    past = [],
    future = [],
    tracking = true,
  } = payload as Partial<
    Pick<History<State, Action>, 'past' | 'future' | 'tracking'>
  >
  const newPresent = past.reduce(
    (accState: State, a: Action): State => reducer(accState, a),
    state.present,
  )
  return {
    ...initialState,
    history: {
      tracking,
      past,
      future,
      snapshot: state.present,
    },
    present: newPresent,
    canUndo: canUndo(config, past),
    canRedo: future.length > 0,
  }
}

function trackAfter<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  action: Action,
  initialState: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const newState = handle(reducer, config, state, action)
  return {
    ...initialState,
    history: {
      ...initialState.history,
      tracking: true,
      snapshot: newState.present,
    },
    present: newState.present,
  }
}

function handle<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  action: Action,
): HistoryState<State, Action> {
  const { history, present } = state
  const { past, tracking } = history

  const newPresent = reducer(present, action)

  if (!tracking || deepEqual(newPresent, present)) {
    return {
      ...state,
      present: newPresent,
    }
  }

  const newPast = [...past, action]

  return {
    history: {
      ...history,
      past: newPast,
      future: [],
    },
    present: newPresent,
    canUndo: canUndo(config, newPast),
    canRedo: false,
  }
}

function canUndo(
  config: UndoableActionsConfig,
  past: UnknownAction[],
): boolean {
  if (past.length === 0) {
    return false
  }

  return (
    config.undoableActionTypes.length === 0 ||
    past.some((a: UnknownAction) => config.undoableActionTypes.includes(a.type))
  )
}
