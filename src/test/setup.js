import { vi } from 'vitest';

vi.mock("localforage", () => {
  let store = {};
  return {
    default: {
      getItem: vi.fn(async (key) => store[key] || null),
      setItem: vi.fn(async (key, val) => { store[key] = val; }),
      removeItem: vi.fn(async (key) => { delete store[key]; }),
      clear: vi.fn(async () => { store = {}; }),
    }
  };
});
