import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLibrary } from "../hooks/useLibrary";

describe("useLibrary hook", () => {
  it("should initialize with default states", () => {
    const { result } = renderHook(() => useLibrary({ setSaveStatus: vi.fn() }));
    expect(result.current.readingList).toBeDefined();
    expect(result.current.savedFiles).toBeDefined();
  });

  it("should update reading progress and auto-transition status", () => {
    const { result } = renderHook(() => useLibrary({ setSaveStatus: vi.fn() }));
    const sampleBook = { title: "Dune", author: "Frank Herbert", readingStatus: "To Read" };

    act(() => {
      result.current.setReadingList([sampleBook]);
    });

    // Update progress to 150 of 500 pages -> status becomes "Reading"
    act(() => {
      result.current.updateBookProgress(sampleBook, 150, 500);
    });

    expect(result.current.readingList[0].currentPage).toBe(150);
    expect(result.current.readingList[0].totalPages).toBe(500);
    expect(result.current.readingList[0].readingStatus).toBe("Reading");

    // Complete book -> status becomes "Finished"
    act(() => {
      result.current.updateBookProgress(sampleBook, 500, 500);
    });

    expect(result.current.readingList[0].currentPage).toBe(500);
    expect(result.current.readingList[0].readingStatus).toBe("Finished");
  });
});

