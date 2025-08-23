import type { Reducer, UnknownAction } from 'redux'
import type {
  ExportedHistory,
  History,
  HistoryAction,
  HistoryState,
  UndoableActionsConfig,
} from './types'
import {
  canRedo,
  canUndo,
  deepEqual,
  isActionTracked,
  isActionUndoable,
} from './utils'
import { HISTORY_KEY } from './actions'

export default function createReducer<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
): Reducer<HistoryState<State, Action>, Action> {
  const initialState = getInitialState(reducer, config)

  return function (
    state: HistoryState<State, Action> | undefined,
    action: Action,
  ) {
    if (!state) {
      return initialState
    }

    switch (action.type) {
      case config.internalActions.undo:
        return undo(reducer, config, state)
      case config.internalActions.redo:
        return redo(reducer, config, state)
      case config.internalActions.reset:
        return reset(config, state, initialState)
      case config.internalActions.hydrate:
        return hydrate(reducer, config, state, action, initialState)
      case config.internalActions.tracking:
        return setTracking(state, action)
      case config.trackAfterAction:
        return trackAfter(reducer, config, state, action, initialState)
      default:
        return handleAction(reducer, config, state, action)
    }
  }
}

function getInitialState<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
): HistoryState<State, Action> {
  const initialPresent = reducer(undefined, {} as Action)

  return {
    present: initialPresent,
    [HISTORY_KEY]: {
      tracking: config.trackAfterAction === undefined,
      actions: [],
      snapshot: initialPresent,
    },
    canUndo: false,
    canRedo: false,
  }
}

function undo<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const history = state[HISTORY_KEY]
  const { actions } = history

  if (!canUndo(config, actions)) {
    return state
  }

  const lastUndoableIndex = actions.findLastIndex(
    (a) => !a.undone && isActionUndoable(config, a.action),
  )

  const undoneAction = getUndoneAction(
    config,
    state,
    actions[lastUndoableIndex],
  )
  const newActions = actions.toSpliced(lastUndoableIndex, 1, undoneAction)

  const present = replay(reducer, newActions, history.snapshot)

  return {
    [HISTORY_KEY]: {
      ...history,
      actions: newActions,
    },
    present,
    canUndo: canUndo(config, newActions),
    canRedo: canRedo(config, newActions),
  }
}

function redo<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const history = state[HISTORY_KEY]
  const { actions } = history

  if (!canRedo(config, actions)) {
    return state
  }

  const firstUndoableIndex = actions.findIndex(
    (a) =>
      a.original !== undefined ||
      (a.undone && isActionUndoable(config, a.action)),
  )

  const redoneAction = getRedoneAction(actions[firstUndoableIndex])
  const newActions = actions.toSpliced(firstUndoableIndex, 1, redoneAction)
  const newPresent = replay(reducer, newActions, history.snapshot)

  return {
    [HISTORY_KEY]: { ...history, actions: newActions },
    present: newPresent,
    canUndo: canUndo(config, newActions),
    canRedo: canRedo(config, newActions),
  }
}

function reset<State, Action extends UnknownAction>(
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  initialState: HistoryState<State, Action>,
): HistoryState<State, Action> {
  if (config.trackAfterAction === undefined) {
    return initialState
  }

  return {
    ...initialState,
    [HISTORY_KEY]: {
      ...initialState[HISTORY_KEY],
      tracking: state[HISTORY_KEY].tracking,
      snapshot: state[HISTORY_KEY].snapshot,
    },
    present: state[HISTORY_KEY].snapshot,
  }
}

function trackAfter<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  action: Action,
  initialState: HistoryState<State, Action>,
): HistoryState<State, Action> {
  const newState = handleAction(reducer, config, state, action)

  return {
    ...initialState,
    [HISTORY_KEY]: {
      ...initialState[HISTORY_KEY],
      tracking: true,
      snapshot: newState.present,
    },
    present: newState.present,
  }
}

function handleAction<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  action: Action,
): HistoryState<State, Action> {
  const { present } = state
  const history = state[HISTORY_KEY]
  const { actions, tracking } = history

  const newPresent = reducer(present, action)

  if (
    !tracking ||
    !isActionTracked(config, action) ||
    deepEqual(newPresent, present) // no change in state
  ) {
    return {
      ...state,
      present: newPresent,
    }
  }

  let newActions = [...actions, { action, undone: false }]
  if (isActionUndoable(config, action)) {
    // clean future actions
    newActions = newActions
      .filter((a) => !a.undone)
      .map((a) => {
        const cleanedAction = { ...a }
        delete cleanedAction.original
        return cleanedAction
      })
  }

  return {
    [HISTORY_KEY]: {
      ...history,
      actions: newActions,
    },
    present: newPresent,
    canUndo: canUndo(config, newActions),
    canRedo: canRedo(config, newActions),
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
  const { actions = [], tracking = true } = payload as ExportedHistory<
    State,
    Action
  >

  const newPresent = replay(reducer, actions, state.present)

  return {
    ...initialState,
    [HISTORY_KEY]: {
      ...initialState[HISTORY_KEY],
      tracking,
      actions,
      snapshot: state.present,
    },
    present: newPresent,
    canUndo: canUndo(config, actions),
    canRedo: canRedo(config, actions),
  }
}

function setTracking<State, Action extends UnknownAction>(
  state: HistoryState<State, Action>,
  action: Action,
): HistoryState<State, Action> {
  const { payload } = action
  const tracking = payload as History<State, Action>['tracking']

  return {
    ...state,
    [HISTORY_KEY]: {
      ...state[HISTORY_KEY],
      tracking,
    },
  }
}
function replay<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  newActions: HistoryAction<Action>[],
  initialState: State,
): State {
  return newActions
    .filter((a) => !a.undone)
    .reduce((accState, a) => reducer(accState, a.action), initialState)
}

function getUndoneAction<State, Action extends UnknownAction>(
  config: UndoableActionsConfig,
  state: HistoryState<State, Action>,
  action: HistoryAction<Action>,
): HistoryAction<Action> {
  if (action.original !== undefined) {
    const undoneAction = {
      ...action,
      action: { ...action.original },
      undone: true,
    }
    delete undoneAction.original
    return undoneAction
  }

  const undoable = config.undoableActions.find(
    (undoable) =>
      (typeof undoable === 'string' ? undoable : undoable.type) ===
      action.action.type,
  )

  if (typeof undoable === 'string' || typeof undoable === 'undefined') {
    return {
      ...action,
      undone: true,
    }
  }

  return {
    ...action,
    action: {
      ...action.action,
      type: undoable.replaceBy,
      payload: undoable.transformPayload(action.action.payload, state),
    },
    undone: false,
    original: { ...action.action },
  }
}

function getRedoneAction<Action extends UnknownAction>(
  action: HistoryAction<Action>,
): HistoryAction<Action> {
  if (action.original !== undefined) {
    const redoneAction = {
      ...action,
      action: {
        ...action.original,
      },
      undone: false,
    }
    delete redoneAction.original
    return redoneAction
  }

  return {
    ...action,
    undone: false,
  }
}
