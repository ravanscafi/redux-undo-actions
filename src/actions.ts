import type { UnknownAction } from 'redux'
import type { History } from './types'

export const HISTORY_KEY = '@@redux-undo-actions'

export const ActionTypes = {
  Undo: `${HISTORY_KEY}/undo`,
  Redo: `${HISTORY_KEY}/redo`,
  Reset: `${HISTORY_KEY}/reset`,
  Tracking: `${HISTORY_KEY}/tracking`,
}

export const ActionCreators = {
  undo: (): UnknownAction => ({ type: ActionTypes.Undo }),
  redo: (): UnknownAction => ({ type: ActionTypes.Redo }),
  reset: (): UnknownAction => ({ type: ActionTypes.Reset }),
  tracking: <State, Action extends UnknownAction>(
    payload: History<State, Action>['tracking'],
  ): UnknownAction => ({ type: ActionTypes.Tracking, payload }),
}
