import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLibrary } from "../hooks/useLibrary";

describe("useLibrary hook", () => {
  it("should initialize with default states", () => {
    const { result } = renderHook(() => useLibrary({ setSaveStatus: vi.fn() }));
    expect(result.current.readingList).toBeDefined();
    expect(result.current.savedFiles).toBeDefined();
  });
});
