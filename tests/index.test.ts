import { describe, expect, it } from 'vitest'
import type { Store, UnknownAction } from 'redux'
import { legacy_createStore as createStore } from 'redux'

import {
  ActionCreators,
  ActionTypes,
  type HistoryAction,
  type HistoryState,
  undoableActions,
} from '../src'
import { HISTORY_KEY } from '../src/actions'

const counterReducer = (
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
    case 'counter/changeName':
      return { ...state, name: action.payload as string }
    default:
      return state
  }
}

function expectCount(
  store: Store<HistoryState<{ name: string; count: number }, UnknownAction>>,
  expectedCount: number,
) {
  expect(store.getState().present.count).toStrictEqual(expectedCount)
}

function expectHistoryActions(
  store: Store<HistoryState<{ name: string; count: number }, UnknownAction>>,
  expectedActions: HistoryAction<UnknownAction>[],
) {
  expect(store.getState()[HISTORY_KEY].actions).toStrictEqual(expectedActions)
}

describe.concurrent('undoableActions', () => {
  it.concurrent('should initialize with default state', () => {
    const store = createStore(undoableActions(counterReducer))
    expectCount(store, 0)
    expectHistoryActions(store, [])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it.concurrent('should not undo if action history is empty', () => {
    const store = createStore(undoableActions(counterReducer))
    store.dispatch(ActionCreators.undo())
    expectCount(store, 0)
    expectHistoryActions(store, [])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it.concurrent('should not redo if there are no future actions', () => {
    const store = createStore(undoableActions(counterReducer))
    store.dispatch(ActionCreators.redo())
    expectCount(store, 0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment' })
    expectCount(store, 1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it.concurrent('should handle multiple undos and redos', () => {
    const store = createStore(undoableActions(counterReducer))
    store.dispatch({ type: 'counter/increment', payload: 1 })
    store.dispatch({ type: 'counter/increment', payload: 2 })
    store.dispatch({ type: 'counter/increment', payload: 3 })
    expectCount(store, 6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expectCount(store, 3)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())
    expectCount(store, 1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())
    expectCount(store, 0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    // Further undo should not change state
    store.dispatch(ActionCreators.undo())
    expectCount(store, 0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    // Redo all
    store.dispatch(ActionCreators.redo())
    expectCount(store, 1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())
    expectCount(store, 3)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())
    expectCount(store, 6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    // Further redo should not change state
    store.dispatch(ActionCreators.redo())
    expectCount(store, 6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it.concurrent(
    'should apply actions with payloads and support undo/redo',
    () => {
      const store = createStore(undoableActions(counterReducer))
      store.dispatch({ type: 'counter/increment', payload: 2 })
      expectCount(store, 2)
      expect(store.getState().canUndo).toStrictEqual(true)
      expect(store.getState().canRedo).toStrictEqual(false)

      store.dispatch({ type: 'counter/increment', payload: 3 })
      expectCount(store, 5)
      expect(store.getState().canUndo).toStrictEqual(true)
      expect(store.getState().canRedo).toStrictEqual(false)

      store.dispatch(ActionCreators.undo())
      expectCount(store, 2)
      expect(store.getState().canUndo).toStrictEqual(true)
      expect(store.getState().canRedo).toStrictEqual(true)

      store.dispatch(ActionCreators.redo())
      expectCount(store, 5)
      expect(store.getState().canUndo).toStrictEqual(true)
      expect(store.getState().canRedo).toStrictEqual(false)
    },
  )

  it.concurrent('should store full actions including payload', () => {
    const store = createStore(undoableActions(counterReducer))
    const action = { type: 'counter/increment', payload: 10 }
    store.dispatch(action)
    expectHistoryActions(store, [{ action, undone: false }])
    expectCount(store, 10)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it.concurrent('should reset the state', () => {
    const store = createStore(undoableActions(counterReducer))
    store.dispatch({ type: 'counter/increment', payload: 10 })
    expectHistoryActions(store, [
      { action: { type: 'counter/increment', payload: 10 }, undone: false },
    ])
    expectCount(store, 10)

    store.dispatch(ActionCreators.reset())
    expectHistoryActions(store, [])
    expectCount(store, 0)
  })

  it.concurrent('should clear future on new action after undo', () => {
    const store = createStore(undoableActions(counterReducer))
    store.dispatch({ type: 'counter/increment' })
    store.dispatch({ type: 'counter/increment' })
    expectCount(store, 2)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expectCount(store, 1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 6)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })
  it.concurrent('hydrates state with actions', () => {
    const store = createStore(undoableActions(counterReducer))

    const actions: HistoryAction<UnknownAction>[] = [
      { action: { type: 'counter/increment' }, undone: false },
      { action: { type: 'counter/increment' }, undone: false },
      { action: { type: 'counter/increment', payload: 10 }, undone: true },
    ]

    store.dispatch(ActionCreators.hydrate({ actions, tracking: true }))

    expectCount(store, 2)

    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(true)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.redo())

    expectCount(store, 12)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())

    expectCount(store, 2)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())

    expectCount(store, 1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())

    expectCount(store, 0)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)
  })

  it.concurrent(
    'should not track actions that do not change the state of the reducer',
    () => {
      const store = createStore(undoableActions(counterReducer))

      store.dispatch({ type: 'counter/increment', payload: 1 })
      expectCount(store, 1)
      expectHistoryActions(store, [
        { action: { type: 'counter/increment', payload: 1 }, undone: false },
      ])

      // Dispatching an action that does not change the state
      store.dispatch({ type: 'unknown/action' })
      expectCount(store, 1)
      expectHistoryActions(store, [
        { action: { type: 'counter/increment', payload: 1 }, undone: false },
      ])

      // Dispatching another action that does not change the state
      expect(store.getState().present.name).toStrictEqual('Counter')
      store.dispatch({
        type: 'counter/changeName',
        payload: 'Counter',
      })
      expectHistoryActions(store, [
        { action: { type: 'counter/increment', payload: 1 }, undone: false },
      ])
    },
  )
})

describe.concurrent('undoableActions with custom config', () => {
  it.concurrent('should only track actions when the state changes', () => {
    const store = createStore(
      undoableActions(counterReducer, {
        undoableActions: ['counter/increment', 'counter/decrement'],
        trackAfterAction: 'counter/start',
        internalActions: {
          undo: 'counter/undo',
          redo: 'counter/redo',
        },
      }),
    )

    expectCount(store, 0)
    expectHistoryActions(store, [])
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 5)
    expectHistoryActions(store, [])
    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(false)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/start', payload: 10 })
    expectCount(store, 10)
    expectHistoryActions(store, [])
    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(true)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 15)
    expectHistoryActions(store, [
      { action: { type: 'counter/increment', payload: 5 }, undone: false },
    ])
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/changeName', payload: 'New Counter Name' })

    store.dispatch({ type: 'counter/undo' })
    expectCount(store, 10)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch({ type: 'counter/undo' })
    expectCount(store, 10)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)

    store.dispatch({ type: 'counter/redo' })
    expectCount(store, 15)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)
  })

  it.concurrent('should only track tracked-actions when config is set', () => {
    const store = createStore(
      undoableActions(counterReducer, {
        trackedActions: [
          'counter/increment',
          'counter/decrement',
          'counter/changeName',
        ],
        undoableActions: ['counter/increment', 'counter/decrement'],
        trackAfterAction: 'counter/start',
      }),
    )

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 5)
    expectHistoryActions(store, [])
    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(false)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/start', payload: 10 })
    expectCount(store, 10)
    expectHistoryActions(store, [])
    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(true)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 15)
    expectHistoryActions(store, [
      { action: { type: 'counter/increment', payload: 5 }, undone: false },
    ])
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/changeName', payload: 'New Counter Name' })
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expectHistoryActions(store, [
      { action: { type: 'counter/increment', payload: 5 }, undone: false },
      {
        action: { type: 'counter/changeName', payload: 'New Counter Name' },
        undone: false,
      },
    ])

    store.dispatch({ type: ActionTypes.Undo })
    expectCount(store, 10)
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)
  })

  it.concurrent('should lose state changes if an action is not tracked', () => {
    const store = createStore(
      undoableActions(counterReducer, {
        trackedActions: ['counter/increment', 'counter/decrement'],
        undoableActions: ['counter/increment', 'counter/decrement'],
        trackAfterAction: 'counter/start',
      }),
    )

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 5)
    expectHistoryActions(store, [])
    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(false)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/start', payload: 10 })
    expectCount(store, 10)
    expectHistoryActions(store, [])
    expect(store.getState()[HISTORY_KEY].tracking).toStrictEqual(true)
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/increment', payload: 5 })
    expectCount(store, 15)
    expectHistoryActions(store, [
      { action: { type: 'counter/increment', payload: 5 }, undone: false },
    ])
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(false)

    store.dispatch({ type: 'counter/changeName', payload: 'New Counter Name' })
    expect(store.getState().present.name).toStrictEqual('New Counter Name')
    expectHistoryActions(store, [
      { action: { type: 'counter/increment', payload: 5 }, undone: false },
    ])

    store.dispatch({ type: ActionTypes.Undo })
    expectCount(store, 10)
    // Since counter/changeName is not tracked, the change of 'New Counter Name' is ignored/lost
    expect(store.getState().present.name).toStrictEqual('Counter')
    expect(store.getState().canUndo).toStrictEqual(false)
    expect(store.getState().canRedo).toStrictEqual(true)
  })

  it.concurrent('should not clear future if an action is not undoable', () => {
    const store = createStore(
      undoableActions(counterReducer, {
        trackedActions: ['counter/increment', 'counter/changeName'],
        undoableActions: ['counter/increment'],
      }),
    )

    store.dispatch({ type: 'counter/increment' })
    store.dispatch({ type: 'counter/increment', payload: 2 })
    expectCount(store, 3)
    expectHistoryActions(store, [
      { action: { type: 'counter/increment' }, undone: false },
      { action: { type: 'counter/increment', payload: 2 }, undone: false },
    ])

    store.dispatch(ActionCreators.undo())
    expectCount(store, 1)
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)
    expectHistoryActions(store, [
      { action: { type: 'counter/increment' }, undone: false },
      { action: { type: 'counter/increment', payload: 2 }, undone: true },
    ])

    store.dispatch({ type: 'counter/changeName', payload: 'The new name' })
    expect(store.getState().present.name).toStrictEqual('The new name')
    expectHistoryActions(store, [
      { action: { type: 'counter/increment' }, undone: false },
      { action: { type: 'counter/increment', payload: 2 }, undone: true },
      {
        action: { type: 'counter/changeName', payload: 'The new name' },
        undone: false,
      },
    ])
    expect(store.getState().canUndo).toStrictEqual(true)
    expect(store.getState().canRedo).toStrictEqual(true)
  })
})
