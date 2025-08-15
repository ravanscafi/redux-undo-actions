import type { UnknownAction } from 'redux'

export interface History<State, Action extends UnknownAction> {
  tracking: boolean
  past: Action[]
  future: {
    action: Action
    index: number
  }[]
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
