import { describe, expect, it, vi } from 'vitest'
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux'
import {
  HISTORY_KEY,
  persistedUndoableActions,
  type Persistence,
  type UndoableActionsConfig,
} from '../src'

interface CounterState {
  count: number
}
const initialState: CounterState = { count: 0 }

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
        actions: [{ action: { type: 'counter/increment' }, skipped: false }],
      }),
    )

    store.dispatch({ type: 'counter/start' })

    await vi.waitFor(() => {
      expect(store.getState().counter.present).toEqual({ count: 1 })
      expect(store.getState().counter[HISTORY_KEY]).toEqual({
        tracking: true,
        actions: [{ action: { type: 'counter/increment' }, skipped: false }],
        snapshot: { count: 0 },
      })
    })
  })

  it.concurrent('should save history when actions happen', async () => {
    const { store, mockStorage } = getStore()
    expect(store.getState().counter.present).toEqual({ count: 0 })

    // start tracking
    store.dispatch({ type: 'counter/start' })

    // wait for load
    await sleep(50) // not sure why vi.wait doesn't work for the last expectation unless we sleep here
    expect(mockStorage.getItem).toHaveBeenCalledExactlyOnceWith('key')

    // start actions
    store.dispatch({ type: 'counter/increment' })
    expect(store.getState().counter.present).toEqual({ count: 1 })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [{ action: { type: 'counter/increment' }, skipped: false }],
      snapshot: { count: 0 },
    })
    // wait for save
    expect(mockStorage.setItem).toHaveBeenCalledOnce()
  })

  it.concurrent('should reset state when clean action happens', async () => {
    const { store, mockStorage } = getStore({
      resetActionType: 'counter/reset',
    })

    // prepare some state
    store.dispatch({ type: 'counter/start' })
    store.dispatch({ type: 'counter/increment' })
    store.dispatch({ type: 'counter/increment' })
    await sleep(50)

    // reset state
    store.dispatch({ type: 'counter/reset' })

    await vi.waitFor(() => {
      expect(mockStorage.removeItem).toHaveBeenCalledExactlyOnceWith('key')
      expect(store.getState().counter.present).toEqual(initialState)
      expect(store.getState().counter[HISTORY_KEY]).toEqual({
        tracking: false,
        actions: [],
        snapshot: initialState,
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
    expect(mockStorage.getItem).toHaveBeenCalledExactlyOnceWith('key')
    // start actions
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => void 0)

    store.dispatch({ type: 'counter/increment' })
    expect(store.getState().counter.present).toEqual({ count: 1 })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [{ action: { type: 'counter/increment' }, skipped: false }],
      snapshot: initialState,
    })

    await vi.waitFor(() => {
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
      expect(mockStorage.getItem).toHaveBeenCalledExactlyOnceWith('key')
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
        expect(mockStorage.removeItem).toHaveBeenCalledExactlyOnceWith('key')
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
      trackAfterActionType: undefined,
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
      trackAfterActionType: undefined,
      trackedActionTypes: ['counter/increment'],
    })

    store.dispatch({ type: 'counter/decrement' })
    expect(store.getState().counter.present).toEqual({ count: -1 })
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [],
      snapshot: initialState,
    })

    store.dispatch({ type: 'counter/increment' })

    expect(store.getState().counter.present).toEqual(initialState)
    expect(store.getState().counter[HISTORY_KEY]).toEqual({
      tracking: true,
      actions: [{ action: { type: 'counter/increment' }, skipped: false }],
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
})

function getStore(
  config?: Partial<UndoableActionsConfig> & {
    persistence?: Partial<Persistence>
  },
) {
  const counterReducer = (
    state: CounterState = initialState,
    action: { type: string },
  ): CounterState => {
    switch (action.type) {
      case 'counter/increment':
        return { count: state.count + 1 }
      case 'counter/decrement':
        return { count: state.count - 1 }
      case 'counter/reset':
        return initialState
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
    trackAfterActionType: 'counter/start',
    hydrateActionType: 'counter/hydrate',
    resetActionType: 'counter/reset',
    ...config,
    persistence: {
      reducerKey: 'counter',
      getStorageKey: () => 'key',
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
