import type { UnknownAction } from 'redux'
import { ActionTypes, HISTORY_KEY } from './actions'

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
  trackedActions: UnknownAction['type'][]
  undoableActions: UnknownAction['type'][]
  trackAfterAction: UnknownAction['type'] | undefined
  internalActions: {
    undo: UnknownAction['type']
    redo: UnknownAction['type']
    reset: UnknownAction['type']
    tracking: UnknownAction['type']
  }
}

export const initialUndoableActionsConfig: UndoableActionsConfig = {
  trackedActions: [],
  undoableActions: [],
  trackAfterAction: undefined,
  internalActions: {
    undo: ActionTypes.Undo,
    redo: ActionTypes.Redo,
    reset: ActionTypes.Reset,
    tracking: ActionTypes.Tracking,
  },
}

export type PersistedUndoableActionsConfig = UndoableActionsConfig & {
  persistence: Persistence
}

type DeepPartial<T> = T extends object
  ? T extends unknown[]
    ? T
    : { [K in keyof T]?: DeepPartial<T[K]> }
  : T

export type PartialUndoableActionsConfig = DeepPartial<UndoableActionsConfig>
