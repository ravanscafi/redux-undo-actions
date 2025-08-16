import type { Reducer, UnknownAction } from 'redux'
import {
  type ExportedHistory,
  HISTORY_KEY,
  type HistoryAction,
  type HistoryState,
  type UndoableActionsConfig,
} from './types'
import {
  canRedo,
  canUndo,
  deepEqual,
  isActionTracked,
  isActionUndoable,
} from './utils'

export default function createHandler<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  config: UndoableActionsConfig,
) {
  const initialState = getInitialState(reducer, config)

  return {
    initialState,
    undo: (state: HistoryState<State, Action>) => undo(reducer, config, state),
    redo: (state: HistoryState<State, Action>) => redo(reducer, config, state),
    hydrate: (state: HistoryState<State, Action>, action: Action) =>
      hydrate(reducer, config, state, action, initialState),
    trackAfter: (state: HistoryState<State, Action>, action: Action) =>
      trackAfter(reducer, config, state, action, initialState),
    handle: (state: HistoryState<State, Action>, action: Action) =>
      handle(reducer, config, state, action),
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
      tracking: config.trackAfterActionType === undefined,
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
    (a) => !a.skipped && isActionUndoable(config, a.action),
  )

  const newActions = actions.toSpliced(lastUndoableIndex, 1, {
    ...actions[lastUndoableIndex],
    skipped: true,
  })

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
  const { present } = state
  const history = state[HISTORY_KEY]
  const { actions } = history

  if (!canRedo(config, actions)) {
    return state
  }

  const firstUndoableIndex = actions.findIndex(
    (a) => a.skipped && isActionUndoable(config, a.action),
  )

  const newActions = actions.toSpliced(firstUndoableIndex, 1, {
    ...actions[firstUndoableIndex],
    skipped: false,
  })

  let newPresent: State

  if (firstUndoableIndex === actions.length - 1) {
    newPresent = reducer(present, newActions[firstUndoableIndex].action)
  } else {
    newPresent = replay(reducer, newActions, history.snapshot)
  }

  return {
    [HISTORY_KEY]: { ...history, actions: newActions },
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
      tracking,
      actions,
      snapshot: state.present,
    },
    present: newPresent,
    canUndo: canUndo(config, actions),
    canRedo: canRedo(config, actions),
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
    [HISTORY_KEY]: {
      ...initialState[HISTORY_KEY],
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

  let newActions = [...actions, { action, skipped: false }]
  if (isActionUndoable(config, action)) {
    // clean future actions
    newActions = newActions.filter((a) => !a.skipped)
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

function replay<State, Action extends UnknownAction>(
  reducer: Reducer<State, Action>,
  newActions: HistoryAction<Action>[],
  initialState: State,
): State {
  return newActions
    .filter((a) => !a.skipped)
    .reduce((accState, a) => reducer(accState, a.action), initialState)
}
