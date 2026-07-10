import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CompareTray from "../components/CompareTray";

const styles = {
  compareTray: {},
  sectionTitle: {},
  countText: {},
  compareTrayActions: {},
  smallButton: {},
  deleteButton: {},
};

describe("CompareTray", () => {
  it("renders compare summary and opens compare", () => {
    const setCompareOpen = vi.fn();

    render(
      <CompareTray
        compare={[{ title: "Book One" }, { title: "Book Two" }]}
        e={(_, label) => label}
        setCompare={vi.fn()}
        setCompareOpen={setCompareOpen}
        styles={styles}
      />
    );

    expect(screen.getByText("Book One vs Book Two")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Compare" }));
    expect(setCompareOpen).toHaveBeenCalledWith(true);
  });
});
