import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
  const developerUser = { email: "shilpispin@gmail.com" };
  const regularUser = { email: "random@user.com" };

  it("should correctly identify developer access", () => {
    expect(hasDeveloperAccess(developerUser)).toBe(true);
    expect(hasDeveloperAccess(regularUser)).toBe(false);
    expect(hasDeveloperAccess(null)).toBe(false);
  });

  it("should return default states for non-developer", () => {
    const { result, unmount } = renderHook(() => useDeveloper(regularUser));
    
    expect(result.current.developerStats.registeredUsers).toBe(0);
    expect(result.current.developerUsage.apiCalls).toBe(0);
    expect(result.current.developerEvents).toEqual([]);
    unmount();
  });

  // Note: testing the exact snapshot return for a developer requires a complex mock for onSnapshot,
  // but we can at least verify that it doesn't crash and initializes with defaults.
  it("should initialize for developer without crashing", async () => {
    const { result, unmount } = renderHook(() => useDeveloper(developerUser));
    
    await waitFor(() => {
      expect(result.current.developerStatsStatus).toBe("");
      expect(result.current.developerUsage.apiCalls).toBe(0);
    });
    unmount();
  });
});
