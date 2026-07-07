import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuth } from "../hooks/useAuth";

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  getRedirectResult: vi.fn(() => Promise.resolve({ user: null })),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb(null);
    return vi.fn();
  })
}));

describe("useAuth hook", () => {
  it("should initialize with loading state and handle unauthenticated user", () => {
    const { result } = renderHook(() => useAuth({ setCurrentPage: vi.fn() }));
    
    // Once effect runs, user is null and loading is false
    expect(result.current.user).toBeNull();
    expect(result.current.authLoading).toBe(false);
  });
});
