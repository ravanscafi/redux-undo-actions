import { describe, expect, it, vi } from 'vitest'
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
  type UnknownAction,
} from 'redux'
import {
  ActionCreators,
  HISTORY_KEY,
  type HistoryState,
  type PartialUndoableActionsConfig,
  persistedUndoableActions,
  type Persistence,
} from '../src'

interface CounterState {
  id: string
  count: number
}
const initialState: CounterState = { id: 'counter-id', count: 0 }

describe.concurrent('persistedUndoableActions', () => {
  it.concurrent('should ignore untracked actions', async () => {
    const { store, mockStorage } = getStore()
    store.dispatch({ type: 'untracked' })
    expect(store.getState().counter.present).toEqual(initialState)
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: false,
      actions: [],
      snapshot: initialState,
    })

    // wait for "possible" save
    await sleep(50)

    expect(mockStorage.getItem).not.toHaveBeenCalled()
    expect(mockStorage.setItem).not.toHaveBeenCalled()
  })

  it.concurrent('should load state when tracking starts', async () => {
    const { store, mockStorage } = getStore()
    mockStorage.getItem = vi.fn().mockResolvedValue(
      JSON.stringify({
        tracking: true,
        actions: [{ action: { type: 'counter/increment' }, undone: false }],
      }),
    )

    store.dispatch({ type: 'counter/start' })

    await vi.waitFor(() => {
      expect(store.getState().counter.present).toEqual({
        id: 'counter-id',
        count: 1,
      })
      expect(store.getState().counter[HISTORY_KEY]).toEqual({
        tracking: true,
        actions: [{ action: { type: 'counter/increment' }, undone: false }],
        snapshot: { id: 'counter-id', count: 0 },
      })
    })
  })

  it.concurrent('should save history when actions happen', async () => {
    const { store, mockStorage } = getStore()
    expect(store.getState().counter.present).toEqual({
      id: 'counter-id',
      count: 0,
    })

    // start tracking
    store.dispatch({ type: 'counter/start' })

    // wait for load
    await sleep(50) // not sure why vi.wait doesn't work for the last expectation unless we sleep here
    expect(mockStorage.getItem).toHaveBeenCalledExactlyOnceWith(
      'key-counter-id',
    )

    // start actions
    store.dispatch({ type: 'counter/increment' })
    expect(store.getState().counter.present).toEqual({
      id: 'counter-id',
      count: 1,
    })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [{ action: { type: 'counter/increment' }, undone: false }],
      snapshot: { id: 'counter-id', count: 0 },
    })
    // wait for save
    expect(mockStorage.setItem).toHaveBeenCalledExactlyOnceWith(
      'key-counter-id',
      expect.any(String),
    )
  })

  it.concurrent('should reset state when reset action happens', async () => {
    const { store, mockStorage } = getStore({
      internalActions: {
        reset: 'counter/reset',
      },
    })

    // reset state before trackAfterAction happens
    store.dispatch({ type: 'counter/reset' })
    expect(store.getState().counter.present).toEqual({
      ...initialState,
    })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      actions: [],
      tracking: false,
      snapshot: { ...initialState },
    })

    // prepare some state
    store.dispatch({ type: 'counter/start', payload: 100 }) //  should be the initial state
    await vi.waitFor(() => {
      expect(store.getState().counter[HISTORY_KEY]).toEqual({
        tracking: true,
        actions: [],
        snapshot: { ...initialState, count: 100 },
      })
    })
    store.dispatch({ type: 'counter/increment' })
    store.dispatch({ type: 'counter/increment' })
    expect(store.getState().counter.present.count).toEqual(102)
    await sleep(50)

    // reset state
    store.dispatch({ type: 'counter/reset' })
    await sleep(50)

    await vi.waitFor(() => {
      expect(mockStorage.removeItem).toHaveBeenNthCalledWith(
        2,
        'key-counter-id',
      )
      expect(store.getState().counter.present).toEqual({
        ...initialState,
        count: 100,
      })
      expect(store.getState().counter[HISTORY_KEY]).toEqual({
        actions: [],
        tracking: true,
        snapshot: { ...initialState, count: 100 },
      })
    })
  })

  it.concurrent('should handle saving storage errors gracefully', async () => {
    const { store, mockStorage } = getStore()
    const error = new Error('failed!')
    mockStorage.setItem = vi.fn().mockRejectedValue(error)

    // start tracking
    store.dispatch({ type: 'counter/start' })

    // wait for load
    await sleep(50)
    expect(mockStorage.getItem).toHaveBeenCalledExactlyOnceWith(
      'key-counter-id',
    )
    // start actions
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => void 0)

    store.dispatch({ type: 'counter/increment' })
    expect(store.getState().counter.present).toEqual({
      id: 'counter-id',
      count: 1,
    })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [{ action: { type: 'counter/increment' }, undone: false }],
      snapshot: initialState,
    })

    await vi.waitFor(() => {
      expect(mockStorage.setItem).toHaveBeenCalledExactlyOnceWith(
        'key-counter-id',
        expect.any(String),
      )
      expect(spy).toHaveBeenCalledExactlyOnceWith(
        'failed to save history to storage',
        error,
      )
    })
    spy.mockRestore()
  })

  it.concurrent('should handle loading storage errors gracefully', async () => {
    const { store, mockStorage } = getStore()
    const error = new Error('failed!')
    mockStorage.getItem = vi.fn().mockRejectedValue(error)

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => void 0)
    // start tracking and trigger loading
    store.dispatch({ type: 'counter/start' })

    await vi.waitFor(() => {
      expect(mockStorage.getItem).toHaveBeenCalledExactlyOnceWith(
        'key-counter-id',
      )
      expect(spy).toHaveBeenCalledExactlyOnceWith(
        'failed to load history from storage',
        error,
      )
    })
    spy.mockRestore()
  })

  it.concurrent(
    'should handle errors when removing from the storage gracefully',
    async () => {
      const { store, mockStorage } = getStore()
      const error = new Error('failed!')
      mockStorage.removeItem = vi.fn().mockRejectedValue(error)

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => void 0)

      // trigger removing
      store.dispatch({ type: 'counter/reset' })

      await vi.waitFor(() => {
        expect(mockStorage.removeItem).toHaveBeenCalledExactlyOnceWith(
          'key-counter-id',
        )
        expect(spy).toHaveBeenCalledExactlyOnceWith(
          'failed to remove history from storage',
          error,
        )
      })
      spy.mockRestore()
    },
  )

  it.concurrent('should reject dispatched non-actions', async () => {
    const { store } = getStore()
    // @ts-expect-error purposely invalid
    await expect(() => store.dispatch(() => undefined)).rejects.toThrow(
      'Invalid action provided! Use custom middleware for async actions.',
    )
  })

  it.concurrent('should identify wrongly configured reducer key', async () => {
    const { store } = getStore({
      trackAfterAction: undefined,
      persistence: { reducerKey: 'wrongKey' },
    })
    await expect(() =>
      store.dispatch({ type: 'counter/decrement' }),
    ).rejects.toThrow(
      'Unexpected state structure, make sure you provided the correct reducerKey: wrongKey',
    )
  })

  it.concurrent('should ignore untracked actions', () => {
    const { store } = getStore({
      trackAfterAction: undefined,
      trackedActions: ['counter/increment'],
    })

    store.dispatch({ type: 'counter/decrement' })
    expect(store.getState().counter.present).toEqual({
      id: 'counter-id',
      count: -1,
    })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [],
      snapshot: initialState,
    })

    store.dispatch({ type: 'counter/increment' })

    expect(store.getState().counter.present).toEqual(initialState)
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [{ action: { type: 'counter/increment' }, undone: false }],
      snapshot: initialState,
    })
  })

  it.concurrent(
    'should dispatch custom dispatchAfterMaybeLoading after hydration',
    async () => {
      const { store, mockStorage } = getStore({
        persistence: {
          dispatchAfterMaybeLoading: 'counter/loaded',
        },
      })
      const spy = vi.fn()
      store.subscribe(() => {
        if (store.getState().counter.present.count === 0) {
          spy()
        }
      })
      mockStorage.getItem = vi.fn().mockResolvedValue(
        JSON.stringify({
          tracking: true,
          actions: [],
          snapshot: initialState,
        }),
      )
      store.dispatch({ type: 'counter/start' })
      await sleep(50)
      expect(spy).toHaveBeenCalled()
    },
  )

  it.concurrent('hydrates state with actions', async () => {
    const { store, mockStorage } = getStore()
    const exportedHistory = {
      tracking: false,
      actions: [
        { action: { type: 'counter/increment' }, undone: false },
        { action: { type: 'counter/increment' }, undone: false },
        { action: { type: 'counter/increment', payload: 10 }, undone: true },
      ],
    }
    mockStorage.getItem = vi
      .fn()
      .mockResolvedValue(JSON.stringify(exportedHistory))

    store.dispatch({ type: 'counter/start', payload: 0 })

    await vi.waitFor(() => {
      expect(store.getState().counter.present.count).toStrictEqual(2)
      expect(store.getState().counter[HISTORY_KEY].tracking).toStrictEqual(
        false,
      )
      expect(store.getState().counter[HISTORY_KEY].actions).toStrictEqual(
        exportedHistory.actions,
      )
      expect(store.getState().counter.canUndo).toStrictEqual(true)
      expect(store.getState().counter.canRedo).toStrictEqual(true)
    })

    // start tracking again
    store.dispatch(ActionCreators.tracking(true))

    store.dispatch(ActionCreators.redo())
    expect(store.getState().counter.present.count).toStrictEqual(12)
    expect(store.getState().counter.canUndo).toStrictEqual(true)
    expect(store.getState().counter.canRedo).toStrictEqual(false)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().counter.present.count).toStrictEqual(2)
    expect(store.getState().counter.canUndo).toStrictEqual(true)
    expect(store.getState().counter.canRedo).toStrictEqual(true)

    store.dispatch(ActionCreators.undo())
    expect(store.getState().counter.present.count).toStrictEqual(1)
    expect(store.getState().counter.canUndo).toStrictEqual(true)
    expect(store.getState().counter.canRedo).toStrictEqual(true)
    store.dispatch(ActionCreators.undo())

    expect(store.getState().counter.present.count).toStrictEqual(0)
    expect(store.getState().counter.canUndo).toStrictEqual(false)
    expect(store.getState().counter.canRedo).toStrictEqual(true)
  })
})

function getStore(
  config?: PartialUndoableActionsConfig & {
    persistence?: Partial<Persistence>
  },
) {
  const counterReducer = (
    state: CounterState = initialState,
    action: UnknownAction,
  ): CounterState => {
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
        return { ...state, count: (action.payload as number) || 0 }
      default:
        return state
    }
  }

  const mockStorage = {
    getItem: vi.fn().mockResolvedValue(undefined),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }
  const persistedReducer = persistedUndoableActions(counterReducer, {
    trackedActions: ['counter/increment', 'counter/decrement'],
    trackAfterAction: 'counter/start',
    ...config,
    internalActions: {
      ...config?.internalActions,
      reset: 'counter/reset',
    },
    persistence: {
      reducerKey: 'counter',
      getStorageKey: (getState: () => unknown) => {
        const { counter } = getState() as {
          counter: HistoryState<CounterState, UnknownAction>
        }

        return `key-${counter.present.id}`
      },
      storage: mockStorage,
      dispatchAfterMaybeLoading: 'counter/loaded',
      ...config?.persistence,
    },
  })

  const store = createStore(
    combineReducers({ counter: persistedReducer.reducer }), // todo: accept root reducer as well
    applyMiddleware(persistedReducer.middleware),
  )

  return { store, mockStorage }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
