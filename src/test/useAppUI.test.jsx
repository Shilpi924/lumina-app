import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppUI, SECTION_DEFAULT_OPEN } from "../hooks/useAppUI";

describe("useAppUI hook", () => {
  it("should initialize with default states", () => {
    const { result } = renderHook(() => useAppUI());
    
    expect(result.current.folderModal.isOpen).toBe(false);
    expect(result.current.manualBookModalOpen).toBe(false);
    expect(result.current.openSections).toEqual(SECTION_DEFAULT_OPEN);
    expect(result.current.discoverIndex).toBe(0);
  });

  it("should toggle sections correctly", () => {
    const { result } = renderHook(() => useAppUI());
    
    act(() => {
      result.current.toggleSection("advanced");
    });
    
    expect(result.current.openSections.advanced).toBe(true);
    
    act(() => {
      result.current.toggleSection("advanced");
    });
    
    expect(result.current.openSections.advanced).toBe(false);
  });

  it("should handle manual book form updates", () => {
    const { result } = renderHook(() => useAppUI());
    
    act(() => {
      result.current.handleManualBookChange("title", "New Book");
      result.current.handleManualBookChange("author", "John Doe");
    });
    
    expect(result.current.manualBookForm.title).toBe("New Book");
    expect(result.current.manualBookForm.author).toBe("John Doe");
  });

  it("should open and close modals", () => {
    const { result } = renderHook(() => useAppUI());
    
    act(() => {
      result.current.openManualBookModal();
    });
    expect(result.current.manualBookModalOpen).toBe(true);
    
    act(() => {
      result.current.closeManualBookModal();
    });
    expect(result.current.manualBookModalOpen).toBe(false);
  });
});
