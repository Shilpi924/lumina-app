import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AppHeader from "../components/AppHeader";

const styles = {
  hero: {},
  heroText: {},
  brandButton: {},
  brandMark: {},
  brandMarkImage: {},
  title: {},
  homeSubtitleBody: {},
};

describe("AppHeader", () => {
  it("renders scan hero copy on the scan page", () => {
    render(
      <AppHeader
        currentPage="scan"
        resetPage={vi.fn()}
        setCurrentPage={vi.fn()}
        user={null}
        styles={styles}
      />
    );

    expect(screen.getByRole("heading", { name: "Lumina" })).toBeTruthy();
    expect(screen.getByText("Take a photo of your bookshelf")).toBeTruthy();
  });

  it("opens the account page when account button is clicked", () => {
    const setCurrentPage = vi.fn();

    render(
      <AppHeader
        currentPage="scan"
        resetPage={vi.fn()}
        setCurrentPage={setCurrentPage}
        user={null}
        styles={styles}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(setCurrentPage).toHaveBeenCalledWith("account");
  });
});
