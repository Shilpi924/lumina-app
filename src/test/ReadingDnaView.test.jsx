import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReadingDnaView from "../components/ReadingDnaView";

describe("ReadingDnaView", () => {
  it("renders empty state correctly", () => {
    render(
      <ReadingDnaView
        readingList={[]}
        readingDna={null}
        onUpdateDna={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByText("Create Your Literary DNA")).toBeTruthy();
    expect(screen.getByText(/Your library is currently empty/)).toBeTruthy();
  });

  it("renders prompt for analysis when books are in library", () => {
    render(
      <ReadingDnaView
        readingList={[{ title: "Project Hail Mary", author: "Andy Weir" }]}
        readingDna={null}
        onUpdateDna={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByRole("button", { name: "Begin AI Analysis (1 books)" })).toBeTruthy();
  });

  it("renders profile details and radar chart when DNA is mapped", () => {
    const mockDna = {
      persona: "The Cosmic Scholar",
      description: "You love exploring dense speculative worlds filled with existential themes.",
      scores: {
        narrativeComplexity: 80,
        emotionalTone: 45,
        readingPace: 70,
        speculativeRealism: 90,
        characterFocus: 55,
        modernity: 85,
      },
      topGenres: ["Science Fiction", "Physics", "Philosophy"],
      signatureThemes: ["Cosmic isolation", "Scientific optimism", "Human collaboration"],
    };

    render(
      <ReadingDnaView
        readingList={[{ title: "Project Hail Mary", author: "Andy Weir" }]}
        readingDna={mockDna}
        onUpdateDna={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByText("The Cosmic Scholar")).toBeTruthy();
    expect(screen.getByText(/You love exploring dense speculative worlds/)).toBeTruthy();
    expect(screen.getByText("📚 Science Fiction")).toBeTruthy();
    expect(screen.getByText("✨ Cosmic isolation")).toBeTruthy();
    expect(screen.getByText("DNA Dimensions")).toBeTruthy();
  });
});
