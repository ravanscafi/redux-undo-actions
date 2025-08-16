import type { UnknownAction } from 'redux'

export interface HistoryAction<Action extends UnknownAction> {
  action: Action
  skipped: boolean
}

export interface History<State, Action extends UnknownAction> {
  tracking: boolean
  actions: HistoryAction<Action>[]
  snapshot: State
}

export interface HistoryState<State, Action extends UnknownAction> {
  present: State
  history: History<State, Action>
  canUndo: boolean
  canRedo: boolean
}

export interface UndoableActionsConfig {
  trackedActionTypes: UnknownAction['type'][]
  undoableActionTypes: UnknownAction['type'][]
  undoActionType: UnknownAction['type']
  redoActionType: UnknownAction['type']
  hydrateActionType: UnknownAction['type']
  trackAfterActionType?: UnknownAction['type']
}
