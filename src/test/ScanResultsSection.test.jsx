import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanResultsSection from "../components/ScanResultsSection";

const styles = {
  grid: {},
  error: {},
};

describe("ScanResultsSection", () => {
  it("renders the single scanned-book section", () => {
    const renderCollapsibleSection = vi.fn(({ title, children }) => (
      <section>
        <h2>{title}</h2>
        {children}
      </section>
    ));
    const renderBookCard = vi.fn((book) => <div key={book.title}>{book.title}</div>);
    const book = { title: "The Hobbit" };

    render(
      <ScanResultsSection
        books={[book]}
        detectedBooks={[]}
        filteredBooks={[book]}
        renderBookCard={renderBookCard}
        renderCollapsibleSection={renderCollapsibleSection}
        styles={styles}
        topBooks={[book]}
      />
    );

    expect(screen.getByText("Scanned book")).toBeTruthy();
    expect(screen.getByText("The Hobbit")).toBeTruthy();
  });
});
