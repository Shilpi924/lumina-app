import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DiscoverPage from "../components/DiscoverPage";

describe("DiscoverPage", () => {
  const styles = {
    pagePanel: {},
    authHeader: {},
    authTitle: {},
    authSubtitle: {},
    authPrimaryButton: {},
  };

  it("renders organization queue correctly", () => {
    render(
      <DiscoverPage
        savedFiles={[]}
        discoverIndex={0}
        setDiscoverIndex={vi.fn()}
        swipeHistory={[]}
        setSwipeHistory={vi.fn()}
        selectedDiscoverFolder="Want to read"
        setSelectedDiscoverFolder={vi.fn()}
        folders={["Want to read"]}
        getVisibleFolders={vi.fn((f) => f)}
        swipeDirection={null}
        bookFolders={{}}
        getBookKey={vi.fn()}
        handleRewind={vi.fn()}
        handleDiscoverDelete={vi.fn()}
        handleSwipe={vi.fn()}
        styles={styles}
      />
    );

    expect(screen.getByText("Organize Library")).toBeTruthy();
    expect(screen.getByText(/organized all your saved books/)).toBeTruthy();
  });
});
