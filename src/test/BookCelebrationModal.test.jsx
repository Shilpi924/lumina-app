import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BookCelebrationModal from "../components/BookCelebrationModal";

describe("BookCelebrationModal", () => {
  const mockBook = {
    title: "Project Hail Mary",
    author: "Andy Weir",
    genre: "Sci-Fi",
  };

  it("renders congratulations header and book details", () => {
    render(<BookCelebrationModal book={mockBook} onClose={vi.fn()} />);
    expect(screen.getByText("You Finished It!")).toBeTruthy();
    expect(screen.getByText("Project Hail Mary")).toBeTruthy();
    expect(screen.getByText("Andy Weir")).toBeTruthy();
  });

  it("calls onClose when clicking Done button", () => {
    const handleClose = vi.fn();
    render(<BookCelebrationModal book={mockBook} onClose={handleClose} />);
    fireEvent.click(screen.getByText("Done"));
    expect(handleClose).toHaveBeenCalled();
  });
});
