import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeveloper, hasDeveloperAccess } from "../hooks/useDeveloper";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
  onSnapshot: vi.fn((ref, cb) => { cb({ exists: () => false, data: () => ({}), docs: [] }); return vi.fn(); })
}));

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../services/firebaseService", () => ({ getDeveloperUsageRef: vi.fn() }));
vi.mock("../utils/stringUtils", () => ({ getTodayKey: vi.fn(() => "2023-10-10") }));

describe("useDeveloper hook", () => {
  it("should correctly identify developer access", () => {
    expect(hasDeveloperAccess({ email: "shilpispin@gmail.com" })).toBe(true);
    expect(hasDeveloperAccess({ email: "random@user.com" })).toBe(false);
    expect(hasDeveloperAccess(null)).toBe(false);
  });

  it("should return default states for non-developer", () => {
    const { result } = renderHook(() => useDeveloper({ email: "random@user.com" }));
    
    expect(result.current.developerStats.registeredUsers).toBe(0);
    expect(result.current.developerUsage.apiCalls).toBe(0);
    expect(result.current.developerEvents).toEqual([]);
  });

  // Note: testing the exact snapshot return for a developer requires a complex mock for onSnapshot,
  // but we can at least verify that it doesn't crash and initializes with defaults.
  it("should initialize for developer without crashing", () => {
    const { result } = renderHook(() => useDeveloper({ email: "shilpispin@gmail.com" }));
    
    expect(result.current.developerStatsStatus).toBe("");
    expect(result.current.developerUsage.apiCalls).toBe(0);
  });
});
