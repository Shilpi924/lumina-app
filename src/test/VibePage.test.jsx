import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VibePage from "../components/VibePage";

describe("VibePage", () => {
  const styles = {
    vibePage: {},
    vibeTitle: {},
    vibeText: {},
    authPrimaryButton: {},
  };

  it("renders prompts to sign in if user is not authenticated", () => {
    render(
      <VibePage
        user={null}
        vibeAiLoading=""
        handleVibeAiAnalysis={vi.fn()}
        vibePhotoInputRef={null}
        savedFiles={[]}
        readingList={[]}
        books={[]}
        scanHistory={[]}
        vibeAiResult={null}
        vibeAiPreviews={{}}
        isUserPlus={false}
        isAnonymousPlus={false}
        selectedPlusPlan=""
        handleStartPlusPurchase={vi.fn()}
        PLUS_PLANS={[]}
        vibeStatus=""
        styles={styles}
      />
    );

    expect(screen.getByText("Your shelf has a personality.")).toBeTruthy();
    expect(screen.getByText(/Sign in to unlock/)).toBeTruthy();
  });
});
