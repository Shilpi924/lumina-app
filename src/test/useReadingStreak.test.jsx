import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReadingStreak } from "../hooks/useReadingStreak";

describe("useReadingStreak", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with 0 streak when empty", () => {
    const { result } = renderHook(() => useReadingStreak());
    expect(result.current.streak).toBe(0);
    expect(result.current.hasReadToday).toBe(false);
    expect(result.current.weeklyHistory).toHaveLength(7);
  });

  it("increments streak when recording activity", () => {
    const { result } = renderHook(() => useReadingStreak());
    act(() => {
      result.current.recordActivity();
    });
    expect(result.current.streak).toBe(1);
    expect(result.current.hasReadToday).toBe(true);
  });

  it("does not increment twice on the same day", () => {
    const { result } = renderHook(() => useReadingStreak());
    act(() => {
      result.current.recordActivity();
    });
    act(() => {
      result.current.recordActivity();
    });
    expect(result.current.streak).toBe(1);
  });
});
