import type { UnknownAction } from 'redux'
import type { ExportedHistory } from './types'

export const ActionTypes = {
  Undo: '@@redux-undo-actions/undo',
  Redo: '@@redux-undo-actions/redo',
  Hydrate: '@@redux-undo-actions/hydrate',
}

export const ActionCreators = {
  undo: (): UnknownAction => ({ type: ActionTypes.Undo }),
  redo: (): UnknownAction => ({ type: ActionTypes.Redo }),
  hydrate: <State, Action extends UnknownAction>(
    payload: ExportedHistory<State, Action>,
  ): UnknownAction => ({
    type: ActionTypes.Hydrate,
    payload,
  }),
}
