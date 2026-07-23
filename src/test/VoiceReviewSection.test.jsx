import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VoiceReviewSection from "../components/VoiceReviewSection";

describe("VoiceReviewSection", () => {
  it("renders empty voice notes placeholder", () => {
    render(
      <VoiceReviewSection
        selectedBook={{ title: "Hyperion", author: "Dan Simmons" }}
        reviews={{}}
        onSaveReview={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByText("Record Your Thoughts")).toBeTruthy();
    expect(screen.getByPlaceholderText(/Your notes will appear here/)).toBeTruthy();
  });

  it("renders saved review correctly when reviews are present", () => {
    const mockReviews = {
      "hyperion-dan simmons": {
        rating: 5,
        quote: "Time is a labyrinth.",
        summary: "A masterpiece of space opera telling complex interlocking traveler tales.",
        themes: ["Space Opera", "Time Travel", "Religion"],
        transcription: "I loved hyperion, the shrike was cool.",
      },
    };

    render(
      <VoiceReviewSection
        selectedBook={{ title: "Hyperion", author: "Dan Simmons" }}
        reviews={mockReviews}
        onSaveReview={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByText('"Time is a labyrinth."')).toBeTruthy();
    expect(screen.getByText("A masterpiece of space opera telling complex interlocking traveler tales.")).toBeTruthy();
    expect(screen.getByText("🏷️ Space Opera")).toBeTruthy();
    expect(screen.getByText(/Original Notes:/)).toBeTruthy();
    expect(screen.getByText(/I loved hyperion, the shrike was cool/)).toBeTruthy();
  });
});
