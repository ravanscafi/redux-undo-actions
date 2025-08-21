import type { UnknownAction } from 'redux'
import type { History, HistoryAction, UndoableActionsConfig } from './types'

export function canUndo<State, Action extends UnknownAction>(
  config: Pick<UndoableActionsConfig, 'undoableActions'>,
  actions: History<State, Action>['actions'],
): boolean {
  actions = actions.filter((a: HistoryAction<Action>) => !a.undone)

  if (actions.length === 0) {
    return false
  }

  return (
    config.undoableActions.length === 0 ||
    actions.some((a: HistoryAction<Action>) =>
      config.undoableActions.includes(a.action.type),
    )
  )
}

export function canRedo<State, Action extends UnknownAction>(
  _: Pick<UndoableActionsConfig, 'undoableActions'>,
  actions: History<State, Action>['actions'],
): boolean {
  return actions.some((action: HistoryAction<Action>) => action.undone)
}

export function isActionUndoable(
  config: Pick<UndoableActionsConfig, 'undoableActions'>,
  action: UnknownAction,
): boolean {
  return (
    config.undoableActions.length === 0 ||
    config.undoableActions.includes(action.type)
  )
}

export function isActionTracked(
  config: Pick<UndoableActionsConfig, 'trackedActions'>,
  action: UnknownAction,
): boolean {
  return (
    config.trackedActions.length === 0 ||
    config.trackedActions.includes(action.type)
  )
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
