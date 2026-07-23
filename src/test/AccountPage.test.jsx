import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AccountPage from "../components/AccountPage";

describe("AccountPage", () => {
  const styles = {
    authPanel: {},
    authHeader: {},
    authTitle: {},
    authSubtitle: {},
    authSecondaryButton: {},
    authNotice: {},
    authForm: {},
    authPrimaryButton: {},
    authActionRow: {},
    googleSignInButton: {},
    authTextButton: {},
    authFooter: {},
    authMessage: {},
  };

  it("renders login form correctly when user is not logged in", () => {
    render(
      <AccountPage
        user={null}
        authMode="signin"
        setAuthMode={vi.fn()}
        authLoading={false}
        setAuthLoading={vi.fn()}
        authMessage=""
        setAuthMessage={vi.fn()}
        setUser={vi.fn()}
        db={null}
        auth={null}
        styles={styles}
        handleGoogleLogin={vi.fn()}
        handleAppleLogin={vi.fn()}
        handleAuthSubmit={vi.fn()}
        handleForgotPassword={vi.fn()}
        handleSignOut={vi.fn()}
        handleResendVerification={vi.fn()}
        handleRefreshVerification={vi.fn()}
        isSyncUser={vi.fn(() => false)}
        getUserDisplayName={vi.fn()}
        CARTOONS={[]}
        setAvatarModalOpen={vi.fn()}
        setAvatarBgColor={vi.fn()}
        setAvatarAccentColor={vi.fn()}
        setAvatarAccessory={vi.fn()}
        setAvatarEyeSize={vi.fn()}
        setAvatarMouth={vi.fn()}
        setAvatarBgImage={vi.fn()}
        disableEmojis={false}
        setDisableEmojis={vi.fn()}
        isFirebaseConfigured={true}
        isAndroidApp={false}
        isAndroidGoogleSsoConfigured={false}
        authForm={{ name: "", email: "", password: "", confirmPassword: "" }}
        updateAuthForm={vi.fn()}
        MAX_DISPLAY_NAME_LENGTH={20}
        GoogleIcon={vi.fn(() => <span>G</span>)}
        AppleIcon={vi.fn(() => <span>A</span>)}
        renderThemeSelector={vi.fn(() => <div>Theme Selector</div>)}
        renderLibraryCards={vi.fn(() => <div>Library Cards</div>)}
        canOpenDeveloper={false}
        renderDeveloperPage={vi.fn()}
      />
    );

    expect(screen.getByText("Log in")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log In" })).toBeTruthy();
  });
});
