import type {
  PartialUndoableActionsConfig,
  PersistedUndoableActionsConfig,
  Persistence,
  UndoableActionsConfig,
} from './types'
import { ActionTypes } from './actions'

const initialUndoableActionsConfig: UndoableActionsConfig = {
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

export function getConfig(
  customConfig?: PartialUndoableActionsConfig,
): UndoableActionsConfig {
  return {
    ...initialUndoableActionsConfig,
    ...customConfig,
    internalActions: {
      ...initialUndoableActionsConfig.internalActions,
      ...customConfig?.internalActions,
    },
  }
}

export function getConfigWithPersistence(
  customConfig: PartialUndoableActionsConfig & { persistence: Persistence },
): PersistedUndoableActionsConfig {
  return {
    ...initialUndoableActionsConfig,
    ...customConfig,
    internalActions: {
      ...initialUndoableActionsConfig.internalActions,
      ...customConfig.internalActions,
    },
  }
}
