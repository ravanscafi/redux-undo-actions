import { describe, expect, it } from 'vitest'
import type { UnknownAction } from 'redux'
import { legacy_createStore as createStore } from 'redux'
import undoableActions, { ActionCreators } from '../src'

const baseReducer = (
  state = { name: 'Counter', count: 0 },
  action: UnknownAction,
): { name: string; count: number } => {
  switch (action.type) {
    case 'counter/increment':
      return {
        ...state,
        count: state.count + ((action.payload as number) || 1),
      }
    case 'counter/decrement':
      return {
        ...state,
        count: state.count - ((action.payload as number) || 1),
      }
    case 'counter/start':
      return { ...state, count: action.payload as number }
    case 'counter/change-name':
      return { ...state, name: action.payload as string }
    default:
      return state
  }
}

describe('undoableActions', () => {
  it('should initialize with default state', () => {
    const store = createStore(undoableActions(baseReducer))
    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().history.past).toStrictEqual([])
    expect(store.getState().history.future).toStrictEqual([])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it('should not undo if history is empty', () => {
    const store = createStore(undoableActions(baseReducer))
    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().history.past).toStrictEqual([])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it('should not redo if future is empty', () => {
    const store = createStore(undoableActions(baseReducer))
    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().history.future).toStrictEqual([])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it('should handle multiple undos and redos', () => {
    const store = createStore(undoableActions(baseReducer))
    store.dispatch({ type: 'counter/increment', payload: 1 })
    store.dispatch({ type: 'counter/increment', payload: 2 })
    store.dispatch({ type: 'counter/increment', payload: 3 })
    expect(store.getState().present.count).toStrictEqual(6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(3)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    // Further undo should not change state
    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    // Redo all
    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(3)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    // Further redo should not change state
    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it('should apply actions with payloads and support undo/redo', () => {
    const store = createStore(undoableActions(baseReducer))
    store.dispatch({ type: 'counter/increment', payload: 2 })
    expect(store.getState().present.count).toStrictEqual(2)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 3 })
    expect(store.getState().present.count).toStrictEqual(5)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(2)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(5)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it('should store full actions including payload', () => {
    const store = createStore(undoableActions(baseReducer))
    const action = { type: 'counter/increment', payload: 10 }
    store.dispatch(action)
    expect(store.getState().history.past[0]).toStrictEqual(action)
    expect(store.getState().present.count).toStrictEqual(10)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it('should clear future on new action after undo', () => {
    const store = createStore(undoableActions(baseReducer))
    store.dispatch({ type: 'counter/increment' })
    store.dispatch({ type: 'counter/increment' })
    expect(store.getState().present.count).toStrictEqual(2)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)
    expect(store.getState().history.future.length).toStrictEqual(1)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expect(store.getState().present.count).toStrictEqual(6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
    expect(store.getState().history.future.length).toStrictEqual(0)
  })
  it('hydrates state with past and future actions', () => {
    const store = createStore(undoableActions(baseReducer))

    const past = [{ type: 'counter/increment' }, { type: 'counter/increment' }]
    const future = [
      { action: { type: 'counter/increment', payload: 10 }, index: 2 },
    ]

    store.dispatch(ActionCreators.hydrate({ past, future }))

    expect(store.getState().present.count).toStrictEqual(2)
    expect(store.getState().history.tracking).toStrictEqual(true)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())
    expect(store.getState().present.count).toStrictEqual(12)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(2)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().present.count).toStrictEqual(1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)
    store.dispatch(ActionCreators.undo())

    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)
  })
})

describe('undoableActions with custom config', () => {
  it('should initialize with default state', () => {
    const store = createStore(
      undoableActions(baseReducer, {
        undoableActionTypes: ['counter/increment', 'counter/decrement'],
        trackAfterActionType: 'counter/start',
        undoActionType: 'counter/undo',
        redoActionType: 'counter/redo',
        hydrateActionType: 'counter/hydrate',
      }),
    )

    expect(store.getState().present.count).toStrictEqual(0)
    expect(store.getState().history.past).toStrictEqual([])
    expect(store.getState().history.future).toStrictEqual([])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expect(store.getState().present.count).toStrictEqual(5)
    expect(store.getState().history.past).toStrictEqual([])
    expect(store.getState().history.future).toStrictEqual([])
    expect(store.getState().history.tracking).toStrictEqual(false)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/start', payload: 10 })
    expect(store.getState().present.count).toStrictEqual(10)
    expect(store.getState().history.past).toStrictEqual([])
    expect(store.getState().history.future).toStrictEqual([])
    expect(store.getState().history.tracking).toStrictEqual(true)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expect(store.getState().present.count).toStrictEqual(15)
    expect(store.getState().history.past).toStrictEqual([
      { type: 'counter/increment', payload: 5 },
    ])
    expect(store.getState().history.future).toStrictEqual([])
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/change-name', payload: 'New Counter Name' })

    store.dispatch({ type: 'counter/undo' })
    expect(store.getState().present.count).toStrictEqual(10)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch({ type: 'counter/undo' })
    expect(store.getState().present.count).toStrictEqual(10)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch({ type: 'counter/redo' })
    expect(store.getState().present.count).toStrictEqual(15)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })
})
