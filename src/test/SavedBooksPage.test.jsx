import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SavedBooksPage from "../components/SavedBooksPage";

describe("SavedBooksPage", () => {
  const styles = {
    pagePanel: {},
    authHeader: {},
    authTitle: {},
    saveStatus: {},
    countText: {},
  };

  it("renders saved books list and components correctly", () => {
    const renderCollapsibleSection = vi.fn((config) => (
      <div key={config.id}>
        <h4>{config.title}</h4>
        <span>Count: {config.meta}</span>
        {config.children}
      </div>
    ));

    render(
      <SavedBooksPage
        folders={["Want to read"]}
        readingList={[]}
        savedFiles={[]}
        bookFolders={{}}
        bookTags={{}}
        activeTagFilter={null}
        setActiveTagFilter={vi.fn()}
        createFolder={vi.fn()}
        deleteFolder={vi.fn()}
        styles={styles}
        getBookKey={vi.fn()}
        getVisibleFolders={vi.fn((f) => f)}
        getFolderDisplayLabel={vi.fn((f) => f)}
        renderCollapsibleSection={renderCollapsibleSection}
        renderBookCard={vi.fn()}
        saveStatus={null}
        AVAILABLE_TAGS={[]}
        renderFavorites={vi.fn(() => <div>Favorites Section</div>)}
        renderSavedFiles={vi.fn(() => <div>Saved Files Section</div>)}
        renderScanHistory={vi.fn(() => <div>Scan History Section</div>)}
      />
    );

    expect(screen.getByText("My Haul 📚")).toBeTruthy();
    expect(screen.getByText("Favorites Section")).toBeTruthy();
    expect(screen.getByText("Saved Files Section")).toBeTruthy();
    expect(screen.getByText("Scan History Section")).toBeTruthy();
  });
});
