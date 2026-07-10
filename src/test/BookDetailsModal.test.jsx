import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BookDetailsModal from "../components/BookDetailsModal";

const styles = {
  modal: {},
  modalContent: {},
  modalHeader: {},
  modalIcon: {},
  detailOrbit: {},
  detailBookCore: {},
  detailLensCore: {},
  detailSparkOne: {},
  detailSparkTwo: {},
  modalTitle: {},
  closeIconButton: {},
};

describe("BookDetailsModal", () => {
  it("renders title and closes from the close button", () => {
    const onClose = vi.fn();

    render(
      <BookDetailsModal
        badgeStyle={{}}
        onClose={onClose}
        selectedBook={{ title: "Dune", shelfPick: "Popular" }}
        styles={styles}
        theme={{ border: "#000", imageBg: "#fff", title: "#111" }}
      >
        <div>Body</div>
      </BookDetailsModal>
    );

    expect(screen.getByRole("heading", { name: "Dune" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalled();
  });
});
