# @ravanscafi/redux-undo-actions

Batteries-included undo/redo for Redux by tracking dispatched actions, enabling
event-sourcing and replay capabilities.

## Features

- **Undo/Redo**: Add undo/redo to any Redux reducer.
- **Action History**: Tracks dispatched actions instead of state changes.
- **Persistence**: Optional middleware for persisting history (e.g.,
  to localStorage or AsyncStorage).
- **TypeScript Support**: Strict types for all APIs.

## Why this library?

- Event-sourcing approach: store actions, not bulky state snapshots.
- Precise control: track and undo only the action types you care about.
- First-class persistence.
- Works with any reducer; minimal API surface.

## Installation

```bash
npm install @ravanscafi/redux-undo-actions
```

## Quick Start

```typescript
import { ActionCreators, undoableActions } from '@ravanscafi/redux-undo-actions'
import { combineReducers, createStore } from 'redux'

function counterReducer(state = 0, action) {
  switch (action.type) {
    case 'counter/increment':
      return state + 1
    case 'counter/decrement':
      return state - 1
    default:
      return state
  }
}

const rootReducer = combineReducers({
  // Wrap your reducer with undoableActions
  counter: undoableActions(counterReducer),
})

const store = createStore(rootReducer)

store.dispatch({ type: 'counter/increment' })
store.dispatch(ActionCreators.undo())
store.dispatch(ActionCreators.redo())

// Access current state via `present`
console.log(store.getState().counter.present)
// Check if undo/redo is possible via `canUndo` and `canRedo`. Useful to enable/disable buttons.
console.log(store.getState().counter.canUndo)
console.log(store.getState().counter.canRedo)
```

### Redux Toolkit examples

Basic usage:

```typescript
import { configureStore } from '@reduxjs/toolkit'
import { undoableActions } from '@ravanscafi/redux-undo-actions'
import counterSlice from './counterSlice'

// Basic
const store = configureStore({
  reducer: {
    counter: undoableActions(counterSlice.reducer, {
      trackedActions: ['counter/increment', 'counter/decrement'],
    }),
  },
})
```

With persistence:

```typescript
import { configureStore } from '@reduxjs/toolkit'
import { persistedUndoableActions } from '@ravanscafi/redux-undo-actions'
import counterSlice from './counterSlice'

// Persisted
const { reducer, middleware } = persistedUndoableActions(counterSlice.reducer, {
  trackedActions: ['counter/increment', 'counter/decrement'],
  persistence: {
    reducerKey: 'counter',
    getStorageKey: () => 'my-app-counter',
    storage: {
      getItem: async (key: string): Promise<string | null> =>
        localStorage.getItem(k),
      setItem: async (key: string, value: string): Promise<void> =>
        localStorage.setItem(k, v),
      removeItem: async (key: string): Promise<void> =>
        localStorage.removeItem(k),
    },
  },
})

const persistedStore = configureStore({
  reducer: { counter: reducer },
  // Put async middlewares first; persistence middleware last
  middleware: (getDefault) => getDefault().concat(middleware),
})
```

Tip: For larger histories, consider compressing the string using a library
like [lz-string](https://github.com/pieroxy/lz-string) (`compressToUTF16`/
`decompressFromUTF16`).

## API

- `undoableActions(reducer, config?) => reducer`
- `persistedUndoableActions(reducer, { ...config, persistence }) => { reducer,
middleware }`
- ActionCreators: `undo()`, `redo()`, `reset()`, `hydrate(history)`, `tracking(
boolean)`

### State shape (HistoryState)

Each wrapped reducer exposes the following shape:

- present: current state
- canUndo: boolean
- canRedo: boolean
- internal history (not for public use):
  - actions: tracked actions
  - snapshot: state at the point where history tracking started
  - tracking: boolean (whether to track new actions)

### Configuration (UndoableActionsConfig)

- trackedActions: string[]
  - Which Redux action types to track in history.
  - Default: [] (track all actions)
- undoableActions: string[]
  - Which tracked actions are undoable/redone.
  - Default: [] (all tracked actions are undoable)
  - Note: Non-undoable tracked actions still update the state but do not clear
    the redo stack.
- trackAfterAction?: string
  - If provided, history tracking starts only after this action is processed.
  - Useful when your initial state loads asynchronously.
- internalActions: { undo, redo, reset, hydrate, tracking }
  - Override internal action types to avoid collisions when using multiple
    instances.
  - If you override these, the built-in ActionCreators no longer match;
    dispatch your custom types manually.

Multiple instances tip:

- If you wrap multiple reducers, give each instance unique internalActions to
  avoid dispatching undo/redo to all of them at once.

Example with custom internal actions:

```typescript
import { ActionCreators } from './actions'

const reducer = undoableActions(counterReducer, {
  trackedActions: ['counter/increment', 'counter/decrement'],
  undoableActions: ['counter/increment'],
  internalActions: {
    undo: 'counter/undo',
    redo: 'counter/redo',
    reset: 'counter/reset',
    hydrate: 'counter/hydrate',
    tracking: 'counter/tracking',
  },
})

// undo will work:
store.dispatch({ type: 'counter/undo' })

// undo will NOT work (wrong type):
store.dispatch(ActionCreators.undo())
```

### Persistence (Persistence)

- reducerKey: string | false
  - The key where your wrapped reducer lives in the root state.
    - E.g., `counter` if your state is `combineReducers({ counter: reducer })`.
  - Use `false` if the wrapped reducer is at the root.
- getStorageKey(getState): string | false
  - Return a unique key for storage, or false to skip persistence (e.g., no
    active document).
  - Example: derive by entity/document ID from state.
- storage: StoragePersistor
  - Async interface for getItem, setItem, removeItem that read/write strings.
- dispatchAfterMaybeLoading?: string
  - Optional action type dispatched 100ms after hydration to help the UI
    settle. E.g., to set `loading` to done.

Middleware order:

- Put async/side-effect middlewares (thunk/saga/observable) before this
  persistence middleware so only plain actions reach it.

What gets saved: a JSON string with { actions, tracking } (ExportedHistory).
`Reset` removes saved history.

Load behavior: when trackAfterAction is seen, the middleware tries to load
history using getStorageKey; if found, it dispatches hydrate with the saved
data, then optionally dispatchAfterMaybeLoading.
If trackAfterAction is not set, loading happens immediately on init.

Example: conditional persistence per entity/document

```typescript
const { reducer, middleware } = persistedUndoableActions(reducer, {
  persistence: {
    reducerKey: 'editor',
    getStorageKey: (getState) => {
      const { activeDocId } = getState() as { activeDocId?: string }
      return activeDocId ? `history_${activeDocId}` : false
    },
    storage: myPersistor,
  },
})
```

### Hydration and tracking

- Hydrate existing history manually:

```typescript
import { ActionCreators } from '@ravanscafi/redux-undo-actions'

store.dispatch(
  ActionCreators.hydrate({
    actions: [{ action: { type: 'counter/increment' }, undone: false }],
    tracking: true,
  }),
)
store.dispatch(ActionCreators.tracking(false)) // disable tracking
store.dispatch(ActionCreators.tracking(true)) // re-enable tracking
```

### Selectors (TypeScript)

```typescript
import type { HistoryState } from '@ravanscafi/redux-undo-actions'
import { UnknownAction } from 'redux'

interface RootState {
  counter: HistoryState<number, UnknownAction>
}

const selectCounter = (s: RootState) => {
  s.counter.present
}
const selectCanUndo = (s: RootState) => {
  s.counter.canUndo
}
const selectCanRedo = (s: RootState) => {
  s.counter.canRedo
}
```

## How it works

- Snapshot and tracking
  - On init, snapshot = reducer(undefined, {}), tracking =
    trackAfterAction === undefined.
  - If trackAfterAction is set, the first time that action is handled,
    tracking is enabled and snapshot becomes the state after that action.
- Action-based history
  - The library stores a list of actions with an undone flag, not
    past/present/future state snapshots.
  - present is always computed by your reducer; on undo/redo, we either replay
    from snapshot or apply a minimal step when possible.
- Undo/Redo semantics
  - Undo marks the most recent undoable tracked action as undone and
    recomputes present.
  - Redo flips the first undone undoable action back; if it’s the last entry,
    we apply the reducer once; otherwise we replay.
  - New undoable actions clear future (redo) actions; non-undoable tracked
    actions do not clear redo.
- Reset and hydrate
  - Reset clears history; with trackAfterAction set, it restores to the
    snapshot right after that action.
  - Hydrate replaces actions and tracking, sets snapshot to the pre-hydration
    present, and replays to compute the new present.
- Guardrails
  - trackedActions and undoableActions default to [] which means “all”.
  - No-op actions that don’t change state (deepEqual) are ignored for history.

## Comparison with [redux-undo](https://github.com/omnidan/redux-undo)

- Model
  - redux-undo: stores past/present/future state snapshots.
  - This library: stores action history (event-sourcing style) plus a
    snapshot, and replays actions to derive state.
- Memory and payloads
  - For large states, storing actions is typically smaller than storing full
    snapshots; persistence can save just the actions.
  - On the other hand, replaying actions can be slower than switching
    snapshots, especially with long histories.
- Control and filtering
  - trackedActions/undoableActions let you scope both what is recorded and
    what is undoable at the action-type level.
  - Redo is cleared only by new undoable actions; non-undoable actions won’t
    wipe redo. Tracked actions that are not undoable still update state, even
    if they happen after the undone action.
- Bootstrapping and hydration
  - trackAfterAction lets you defer history until initial data loads; built-in
    hydrate action and persistence middleware make reload/restore
    straightforward.

Both approaches are valid; choose based on whether you prefer state snapshots (
redux-undo) or action/event history (this library). Also, test for performance.

## Examples

Check the examples folder for more:

- Minimal counter example: [examples/counter](./examples/counter)

To run the examples locally, make sure to first build the base package:

```bash
npm install
npm run build
# open the example code and follow the instructions in their README
```

## Compatibility

- Redux: >= 5 (peer dependency)
- TypeScript: >= 5 (dev setup)

## License

[MIT](./LICENSE)
