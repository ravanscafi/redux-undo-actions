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

export const HISTORY_KEY = '__redux_undo_actions_history'

export interface HistoryState<State, Action extends UnknownAction> {
  present: State
  canUndo: boolean
  canRedo: boolean
  [HISTORY_KEY]: History<State, Action>
}

export interface UndoableActionsConfig {
  trackedActionTypes: UnknownAction['type'][]
  undoableActionTypes: UnknownAction['type'][]
  undoActionType: UnknownAction['type']
  redoActionType: UnknownAction['type']
  hydrateActionType: UnknownAction['type']
  trackAfterActionType?: UnknownAction['type']
}
