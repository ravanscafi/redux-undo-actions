import type { UnknownAction } from 'redux'
import { ActionTypes } from './actions'

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

export type ExportedHistory<State, Action extends UnknownAction> = Pick<
  History<State, Action>,
  'actions' | 'tracking'
>

export interface Persistence {
  reducerKey: string
  getStorageKey: (getState: () => unknown) => string
  storage: StoragePersistor
  dispatchAfterMaybeLoading?: UnknownAction['type']
}

export interface StoragePersistor {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export interface UndoableActionsConfig {
  trackedActionTypes: UnknownAction['type'][]
  undoableActionTypes: UnknownAction['type'][]
  undoActionType: UnknownAction['type']
  redoActionType: UnknownAction['type']
  resetActionType: UnknownAction['type']
  hydrateActionType: UnknownAction['type']
  trackAfterActionType: UnknownAction['type'] | undefined
}

export const initialUndoableActionsConfig: UndoableActionsConfig = {
  undoActionType: ActionTypes.Undo,
  redoActionType: ActionTypes.Redo,
  resetActionType: ActionTypes.Reset,
  hydrateActionType: ActionTypes.Hydrate,
  undoableActionTypes: [],
  trackedActionTypes: [],
  trackAfterActionType: undefined,
}

export type PersistedUndoableActionsConfig = UndoableActionsConfig & {
  persistence: Persistence
}
