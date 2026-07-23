import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CompareBooksModal from "../components/CompareBooksModal";

describe("CompareBooksModal", () => {
  const styles = {
    modal: {},
    compareModalContent: {},
    previewHeader: {},
    modalTitle: {},
    previewSubtitle: {},
    closeIconButton: {},
    compareTableScroll: {},
    compareTable: {},
    compareRow: {},
    compareLabel: {},
    compareValueStrong: {},
    previewActionRow: {},
    secondaryButton: {},
    closeButton: {},
  };

  const mockCompare = [
    { title: "The Hobbit", author: "J.R.R. Tolkien", rating: 4.8, genre: "Fantasy", readingLevel: "Intermediate", gradeBand: "7+", ageRecommendation: "All ages", summary: "A great adventure.", whyRead: "Excellent world building." },
    { title: "Fellowship of the Ring", author: "J.R.R. Tolkien", rating: 4.9, genre: "Fantasy", readingLevel: "Advanced", gradeBand: "7+", ageRecommendation: "Teen/Adult", summary: "The quest begins.", whyRead: "Classic fantasy masterpiece." }
  ];

  it("renders side-by-side comparative grid columns", () => {
    render(
      <CompareBooksModal
        compare={mockCompare}
        setCompare={vi.fn()}
        setCompareOpen={vi.fn()}
        styles={styles}
      />
    );

    expect(screen.getByText("⚖️ Side-by-Side Comparison")).toBeTruthy();
    expect(screen.getByText("The Hobbit")).toBeTruthy();
    expect(screen.getByText("Fellowship of the Ring")).toBeTruthy();
    expect(screen.getByText("✨ Lumina AI Match Report")).toBeTruthy();
  });
});
