import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import ArShelfSync from "../components/ArShelfSync";

describe("ArShelfSync", () => {
  beforeEach(() => {
    // Bypass HTMLMediaElement srcObject type check in happy-dom
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      get() {
        return this._srcObject;
      },
      set(value) {
        this._srcObject = value;
      },
      configurable: true,
    });

    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  it("renders live scanner UI components correctly", async () => {
    await act(async () => {
      render(
        <ArShelfSync
          onClose={vi.fn()}
          onAddBookToLibrary={vi.fn()}
          isBookInReadingList={vi.fn()}
          readingDna={null}
          readingList={[]}
        />
      );
    });

    expect(screen.getByText("Live AR Shelf Mode")).toBeTruthy();
    expect(screen.getByRole("button", { name: "✕ Close AR" })).toBeTruthy();
    expect(screen.getByText(/AR Camera Active/)).toBeTruthy();
  });
});
