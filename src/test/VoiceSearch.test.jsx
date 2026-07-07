import { describe, it, expect } from "vitest";
import { getSearchIntent } from "../App";

describe("Voice Search Intent Parser", () => {
  it("converts spelled out voice search numbers to digits for rating", () => {
    const intent = getSearchIntent("rating above four");
    expect(intent.minRating).toBe(4);
    expect(intent.terms).toHaveLength(0); // 'four' shouldn't be left behind as a text filter
  });

  it("converts spelled out voice search numbers to digits for grade levels", () => {
    const intent = getSearchIntent("grade three");
    expect(intent.gradeBand).toBe("k-3");
    expect(intent.terms).toHaveLength(0); 
  });

  it("handles normal numbers correctly", () => {
    const intent = getSearchIntent("rating above 4.5");
    expect(intent.minRating).toBe(4.5);
    expect(intent.terms).toHaveLength(0);
  });

  it("handles mixed filters correctly", () => {
    const intent = getSearchIntent("fiction rating above five");
    expect(intent.minRating).toBe(5);
    expect(intent.terms).toContain("fiction");
  });
});
