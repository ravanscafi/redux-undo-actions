import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  deepEqual,
  exportHistory,
  isActionTracked,
  isActionUndoable,
} from '../src/utils'
import { HISTORY_KEY } from '../src/types'

describe.concurrent('canUndo', () => {
  const config = {
    undoableActionTypes: ['file/add', 'file/remove'],
  }
  const actions = [
    { action: { type: 'file/add' }, skipped: false },
    { action: { type: 'file/remove' }, skipped: false },
    { action: { type: 'file/update' }, skipped: false },
  ]

  it.concurrent('returns true if there are undoable actions', () => {
    expect(canUndo(config, actions)).toBe(true)
  })

  it.concurrent('returns false if no actions', () => {
    expect(canUndo(config, [])).toBe(false)
  })

  it.concurrent('returns false if all actions are skipped', () => {
    const skippedActions = actions.map((a) => ({ ...a, skipped: true }))
    expect(canUndo(config, skippedActions)).toBe(false)
  })
})

describe.concurrent('canRedo', () => {
  const config = { undoableActionTypes: ['file/add', 'file/remove'] }
  const actions = [
    { action: { type: 'file/add' }, skipped: false },
    { action: { type: 'file/remove' }, skipped: true },
  ]

  it.concurrent('returns true if any action is skipped', () => {
    expect(canRedo(config, actions)).toBe(true)
  })

  it.concurrent('returns false if no actions are skipped', () => {
    const noSkipped = actions.map((a) => ({ ...a, skipped: false }))
    expect(canRedo(config, noSkipped)).toBe(false)
  })
})

describe.concurrent('isActionUndoable', () => {
  const config = { undoableActionTypes: ['file/add', 'file/remove'] }

  it.concurrent('returns true for undoable action', () => {
    expect(isActionUndoable(config, { type: 'file/add' })).toBe(true)
  })

  it.concurrent('returns false for non-undoable action', () => {
    expect(isActionUndoable(config, { type: 'file/update' })).toBe(false)
  })

  it.concurrent('returns true if undoableActionTypes is empty', () => {
    expect(
      isActionUndoable({ undoableActionTypes: [] }, { type: 'file/open' }),
    ).toBe(true)
  })
})

describe.concurrent('isActionTracked', () => {
  const config = { trackedActionTypes: ['file/add', 'file/remove'] }

  it.concurrent('returns true for tracked action', () => {
    expect(isActionTracked(config, { type: 'file/add' })).toBe(true)
  })

  it.concurrent('returns false for non-tracked action', () => {
    expect(isActionTracked(config, { type: 'file/update' })).toBe(false)
  })

  it.concurrent('returns true if trackedActionTypes is empty', () => {
    expect(
      isActionTracked({ trackedActionTypes: [] }, { type: 'file/open' }),
    ).toBe(true)
  })
})

describe.concurrent('exportHistory', () => {
  it.concurrent('exports a serializable snapshot of history state', () => {
    const historyState = {
      [HISTORY_KEY]: {
        actions: [
          { action: { type: 'file/add', payload: 1 }, skipped: false },
          { action: { type: 'file/remove', payload: 2 }, skipped: true },
        ],
        tracking: true,
        snapshot: { some: 'data' },
      },
      present: { some: 'state' },
      canUndo: true,
      canRedo: true,
    }
    const exported = exportHistory(historyState)
    expect(exported).toEqual({
      actions: [
        { action: { type: 'file/add', payload: 1 }, skipped: false },
        { action: { type: 'file/remove', payload: 2 }, skipped: true },
      ],
      tracking: true,
    })
    // Should be serializable
    expect(() => JSON.stringify(exported)).not.toThrow()
  })

  it.concurrent('handles empty actions and tracking', () => {
    const historyState = {
      [HISTORY_KEY]: {
        actions: [],
        tracking: false,
        snapshot: { some: 'data' },
      },
      present: { some: 'state' },
      canUndo: false,
      canRedo: false,
    }
    const exported = exportHistory(historyState)
    expect(exported).toEqual({ actions: [], tracking: false })
  })

  it.concurrent(
    'falls back to JSON.parse if structuredClone is unavailable',
    () => {
      const originalStructuredClone = globalThis.structuredClone
      delete (globalThis as Partial<typeof globalThis>).structuredClone

      const historyState = {
        [HISTORY_KEY]: {
          actions: [
            { action: { type: 'file/add', payload: 123 }, skipped: false },
          ],
          tracking: true,
          snapshot: { some: 'data' },
        },
        present: { some: 'state' },
        canUndo: true,
        canRedo: false,
      }
      const exported = exportHistory(historyState)
      expect(exported).toEqual({
        actions: [
          { action: { type: 'file/add', payload: 123 }, skipped: false },
        ],
        tracking: true,
      })
      expect(() => JSON.stringify(exported)).not.toThrow()

      globalThis.structuredClone = originalStructuredClone
    },
  )
})

describe.concurrent('deepEqual', () => {
  it.concurrent('returns true for primitives that are equal', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual(null, null)).toBe(true)
  })

  it.concurrent('returns false for primitives that are not equal', () => {
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual('a', 'b')).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
  })

  it.concurrent('returns true for deeply equal objects', () => {
    expect(deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(true)
  })

  it.concurrent(
    'returns false for objects with different keys or values',
    () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    },
  )

  it.concurrent('returns false for similar objects', () => {
    expect(deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3, 4] })).toBe(false)
  })

  it.concurrent('returns false for objects with different prototypes', () => {
    class A {
      x = 1
    }
    class B {
      x = 1
    }
    expect(deepEqual(new A(), new B())).toBe(false)
    expect(deepEqual(new A().x, new B().x)).toBe(true)
  })
})
