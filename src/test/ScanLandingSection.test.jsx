import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ScanLandingSection from "../components/ScanLandingSection";

const styles = {
  homeGreetingPanel: {},
  homeGreetingTitle: {},
  uploadBox: {},
  cameraButton: {},
  scanButtonNeedsAuth: {},
  uploadPhotoButton: {},
  manualBookButton: {},
  previewBlock: {},
  preview: {},
  clearPreviewButton: {},
  error: {},
};

describe("ScanLandingSection", () => {
  it("renders scan actions and greeting", () => {
    render(
      <ScanLandingSection
        anonymousScanCount={0}
        authReady
        books={[]}
        cameraIdle={false}
        e={(_, label) => label}
        error=""
        handleBarcodeScan={vi.fn()}
        handleImage={vi.fn()}
        handleScanPickerClick={vi.fn()}
        homeGreeting="Good evening"
        imagePreview={null}
        isAnonymousPlus={false}
        isFirebaseConfigured
        isOffline={false}
        isUserPlus={false}
        loading={false}
        openManualBookModal={vi.fn()}
        renderFilterControls={() => <div>Filters</div>}
        setBooks={vi.fn()}
        setCameraIdle={vi.fn()}
        setCompare={vi.fn()}
        setCompareOpen={vi.fn()}
        setError={vi.fn()}
        setImagePreview={vi.fn()}
        setSaveStatus={vi.fn()}
        setSelectedBook={vi.fn()}
        setSimilarBooksView={vi.fn()}
        shelfPhotoHistory={[]}
        styles={styles}
        user={null}
        userScanCount={0}
      />
    );

    expect(screen.getByText("Good evening")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scan Barcode" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Book Manually" })).toBeTruthy();
    expect(screen.getByText("Filters")).toBeTruthy();
  });

  it("calls manual add handler", () => {
    const openManualBookModal = vi.fn();

    render(
      <ScanLandingSection
        anonymousScanCount={0}
        authReady={false}
        books={[]}
        cameraIdle={false}
        e={(_, label) => label}
        error=""
        handleBarcodeScan={vi.fn()}
        handleImage={vi.fn()}
        handleScanPickerClick={vi.fn()}
        homeGreeting=""
        imagePreview={null}
        isAnonymousPlus={false}
        isFirebaseConfigured
        isOffline={false}
        isUserPlus={false}
        loading={false}
        openManualBookModal={openManualBookModal}
        renderFilterControls={() => null}
        setBooks={vi.fn()}
        setCameraIdle={vi.fn()}
        setCompare={vi.fn()}
        setCompareOpen={vi.fn()}
        setError={vi.fn()}
        setImagePreview={vi.fn()}
        setSaveStatus={vi.fn()}
        setSelectedBook={vi.fn()}
        setSimilarBooksView={vi.fn()}
        shelfPhotoHistory={[]}
        styles={styles}
        user={null}
        userScanCount={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Book Manually" }));
    expect(openManualBookModal).toHaveBeenCalled();
  });
});
