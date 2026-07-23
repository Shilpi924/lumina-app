import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReadingJourneyTimeline from "../components/ReadingJourneyTimeline";

describe("ReadingJourneyTimeline", () => {
  it("renders empty journey setup form correctly", () => {
    render(
      <ReadingJourneyTimeline
        readingList={[]}
        readingDna={null}
        readingJourney={null}
        onUpdateJourney={vi.fn()}
        onAddBookToLibrary={vi.fn()}
        isBookInReadingList={vi.fn()}
      />
    );

    expect(screen.getByText("Plan Your Next Chapter")).toBeTruthy();
    expect(screen.getByPlaceholderText(/e.g., Deep dive into space operas/)).toBeTruthy();
  });

  it("renders timeline books correctly when journey is present", () => {
    const mockJourney = [
      {
        title: "Dune",
        author: "Frank Herbert",
        whyNow: "Learn how deep world-building and ecology intersect in fiction.",
        connectingThread: "Start your journey with this sci-fi foundational space opera.",
        estimatedReadingTime: "14 hours",
        genre: "Science Fiction",
      },
    ];

    render(
      <ReadingJourneyTimeline
        readingList={[]}
        readingDna={null}
        readingJourney={mockJourney}
        onUpdateJourney={vi.fn()}
        onAddBookToLibrary={vi.fn()}
        isBookInReadingList={vi.fn(() => false)}
      />
    );

    expect(screen.getByText("Dune")).toBeTruthy();
    expect(screen.getByText("by Frank Herbert")).toBeTruthy();
    expect(screen.getByText(/Start your journey with this sci-fi/)).toBeTruthy();
    expect(screen.getByText(/Learn how deep world-building/)).toBeTruthy();
    expect(screen.getByText("📥 Add to Stash")).toBeTruthy();
  });
});
