import type { UnknownAction } from 'redux'
import {
  type History,
  HISTORY_KEY,
  type HistoryAction,
  type HistoryState,
  type UndoableActionsConfig,
} from './types'

export function canUndo<State, Action extends UnknownAction>(
  config: Pick<UndoableActionsConfig, 'undoableActionTypes'>,
  actions: History<State, Action>['actions'],
): boolean {
  actions = actions.filter((a: HistoryAction<Action>) => !a.skipped)

  if (actions.length === 0) {
    return false
  }

  return (
    config.undoableActionTypes.length === 0 ||
    actions.some((a: HistoryAction<Action>) =>
      config.undoableActionTypes.includes(a.action.type),
    )
  )
}
export function canRedo<State, Action extends UnknownAction>(
  _: Pick<UndoableActionsConfig, 'undoableActionTypes'>,
  actions: History<State, Action>['actions'],
): boolean {
  return actions.some((action: HistoryAction<Action>) => action.skipped)
}

export function isActionUndoable(
  config: Pick<UndoableActionsConfig, 'undoableActionTypes'>,
  action: UnknownAction,
): boolean {
  return (
    config.undoableActionTypes.length === 0 ||
    config.undoableActionTypes.includes(action.type)
  )
}

export function isActionTracked(
  config: Pick<UndoableActionsConfig, 'trackedActionTypes'>,
  action: UnknownAction,
): boolean {
  return (
    config.trackedActionTypes.length === 0 ||
    config.trackedActionTypes.includes(action.type)
  )
}

/**
 * Exports a serializable snapshot of the history state.
 * You can use this to save the history state to local storage or send it over the network.
 * Later, you can use the `hydrate` action to restore this same state.
 *
 * Notice that the actual `present` state is not exported.
 *
 * @param historyState The current HistoryState to export.
 * @returns A serializable snapshot of the history state.
 */
export function exportHistory<State, Action extends UnknownAction>(
  historyState: HistoryState<State, Action>,
): Pick<History<State, Action>, 'actions' | 'tracking'> {
  const state = {
    actions: historyState[HISTORY_KEY].actions,
    tracking: historyState[HISTORY_KEY].tracking,
  }

  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(state)
  }

  return JSON.parse(JSON.stringify(state)) as Pick<
    History<State, Action>,
    'actions' | 'tracking'
  >
}

export function deepEqual<T>(a: T, b: T): boolean
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
      return false
    }

    const keysA = Reflect.ownKeys(a)
    const keysB = Reflect.ownKeys(b)
    if (keysA.length !== keysB.length) {
      return false
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false
      }
      if (
        !deepEqual(
          (a as Record<PropertyKey, unknown>)[key],
          (b as Record<PropertyKey, unknown>)[key],
        )
      ) {
        return false
      }
    }
    return true
  }

  return false
}
