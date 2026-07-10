import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BookDetailSummaryGrid from "../components/BookDetailSummaryGrid";

const styles = {
  detailGrid: {},
  detailMiniCard: {},
  inlineSelect: {},
};

describe("BookDetailSummaryGrid", () => {
  it("renders confidence and updates folder selection", () => {
    const handleFolderSelect = vi.fn();
    const book = {
      title: "Dune",
      rating: "4.5",
      ratingSource: "Google Books",
      genre: "Sci-Fi",
      ageRecommendation: "13+",
      readingLevel: "Advanced",
      gradeBand: "8-10",
    };

    render(
      <BookDetailSummaryGrid
        bookFolders={{ Dune: "Want to read" }}
        folders={["Want to read", "Favorites"]}
        getBookKey={(selectedBook) => selectedBook.title}
        getScanConfidenceDisplayLabel={() => "Confidence: high"}
        getVisibleFolders={(folders) => folders}
        handleFolderSelect={handleFolderSelect}
        newFolderOption="__new__"
        selectedBook={book}
        styles={styles}
      />
    );

    expect(screen.getByText("Confidence: high")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Book folder"), {
      target: { value: "Favorites" },
    });
    expect(handleFolderSelect).toHaveBeenCalledWith(book, "Favorites");
  });
});
