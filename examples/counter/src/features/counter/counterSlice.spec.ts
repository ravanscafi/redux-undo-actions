import {
  type CounterState,
  increment,
  decrement,
  incrementByAmount,
  counterSlice,
} from './counterSlice'
import { describe, it, expect } from 'vitest'

describe('counter reducer', () => {
  const initialState: CounterState = {
    value: 3,
    status: 'idle',
  }
  it('should handle initial state', () => {
    expect(counterSlice.reducer(undefined, { type: 'unknown' })).toEqual({
      value: 0,
      status: 'idle',
    })
  })

  it('should handle increment', () => {
    const actual = counterSlice.reducer(initialState, increment())
    expect(actual.value).toEqual(4)
  })

  it('should handle decrement', () => {
    const actual = counterSlice.reducer(initialState, decrement())
    expect(actual.value).toEqual(2)
  })

  it('should handle incrementByAmount', () => {
    const actual = counterSlice.reducer(initialState, incrementByAmount(2))
    expect(actual.value).toEqual(5)
  })
})
