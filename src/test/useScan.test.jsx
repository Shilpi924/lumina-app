import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScan } from "../hooks/useScan";

// Mock Capacitor and localforage
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("localforage", () => ({ default: { setItem: vi.fn(), getItem: vi.fn() } }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), setDoc: vi.fn() }));

describe("useScan hook", () => {
  it("should initialize with default states", () => {
    const { result } = renderHook(() => useScan({ db: {}, user: { uid: '123' } }));
    expect(result.current.scanHistory).toEqual([]);
    expect(result.current.scanLimitModalState).toBeNull();
    expect(result.current.userScanCount).toBe(0);
  });

  it("should check scan limit properly for anonymous user", () => {
    const { result } = renderHook(() => useScan({ db: {}, user: null }));
    
    // Simulate they hit the limit of 3 today
    act(() => {
      result.current.setLastScanDate(new Date().toISOString().split("T")[0]);
      result.current.setAnonymousScanCount(3);
    });

    let canScan;
    act(() => {
      canScan = result.current.checkScanLimit();
    });
    expect(canScan).toBe(false);
    expect(result.current.scanLimitModalState).toBe("login_required");
  });

  it("should increment user scan count", async () => {
    const { result } = renderHook(() => useScan({ db: {}, user: { uid: '123' } }));
    
    await act(async () => {
      await result.current.incrementScanCount();
    });

    expect(result.current.userScanCount).toBe(1);
  });
});
