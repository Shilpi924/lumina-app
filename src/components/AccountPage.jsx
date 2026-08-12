import { useState } from "react";
import localforage from "localforage";
import { doc, setDoc } from "firebase/firestore";

export default function AccountPage({
  user,
  authMode,
  setAuthMode,
  authLoading,
  setAuthLoading,
  authMessage,
  setAuthMessage,
  setUser,
  db,
  auth,
  styles,
  handleGoogleLogin,
  handleAuthSubmit,
  handleForgotPassword,
  handleSignOut,
  handleResendVerification,
  handleRefreshVerification,
  isSyncUser,
  getUserDisplayName,
  CARTOONS,
  setAvatarModalOpen,
  setAvatarBgColor,
  setAvatarAccentColor,
  setAvatarAccessory,
  setAvatarEyeSize,
  setAvatarMouth,
  setAvatarBgImage,
  disableEmojis,
  setDisableEmojis,
  isFirebaseConfigured,
  isAndroidApp,
  isAndroidGoogleSsoConfigured,
  authForm,
  updateAuthForm,
  MAX_DISPLAY_NAME_LENGTH,
  GoogleIcon,
  renderThemeSelector,
  renderLibraryCards,
  canOpenDeveloper,
  renderDeveloperPage,
  savedFiles = [],
  folders = [],
  reviews = {},
}) {
  const isSignUp = authMode === "signup";
  const accountUser = isSyncUser(user) ? user : null;

  const [achievementsOpen, setAchievementsOpen] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem("lumina_weekly_reading_goal") || "3";
    }
    return "3";
  });
  const [featuredBadge, setFeaturedBadge] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem("lumina_featured_badge") || "first_scan";
    }
    return "first_scan";
  });

  const handleWeeklyGoalChange = (val) => {
    setWeeklyGoal(val);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("lumina_weekly_reading_goal", val);
    }
  };

  const handleFeaturedBadgeChange = (badgeId) => {
    setFeaturedBadge(badgeId);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("lumina_featured_badge", badgeId);
    }
  };

  const handleProfilePictureUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_SIZE = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round(height * (MAX_SIZE / width));
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round(width * (MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        try {
          setAuthLoading(true);
          if (auth.currentUser) {
            localforage.setItem("profilePic_" + auth.currentUser.uid, dataUrl);
            setUser((prev) => ({ ...prev, customPhotoURL: dataUrl }));
            
            if (db) {
              const userRef = doc(db, "users", auth.currentUser.uid);
              await setDoc(userRef, { customPhotoURL: dataUrl }, { merge: true });
            }

            setAuthMessage("Profile picture updated!");
          }
        } catch (error) {
          console.error("Error updating profile picture", error);
          setAuthMessage("Failed to update profile picture: " + error.message);
        } finally {
          setAuthLoading(false);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const renderAuthSection = () => {
    if (accountUser) {
      return (
        <section style={styles.authPanel}>
          <div style={styles.authHeader}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <label style={{ cursor: "pointer", position: "relative", flexShrink: 0 }}>
                    {accountUser.customPhotoURL || accountUser.photoURL ? (
                      <img src={accountUser.customPhotoURL || accountUser.photoURL} alt="Profile" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)" }} />
                    ) : (
                      <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--code-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="var(--text)"/>
                        </svg>
                      </div>
                    )}
                    <div style={{ position: "absolute", bottom: "-4px", right: "-4px", background: "var(--social-bg)", border: "1px solid var(--border)", borderRadius: "50%", padding: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfilePictureUpload} disabled={authLoading} />
                  </label>
                  <div>
                    <h2 style={{ ...styles.authTitle, marginBottom: "4px" }}>Account</h2>
                    <p style={{ ...styles.authSubtitle, margin: 0 }}>
                      Signed in as {getUserDisplayName(accountUser)}
                      {accountUser.email ? ` (${accountUser.email})` : ""}.
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  style={{...styles.authSecondaryButton, padding: "6px 12px", fontSize: "12px", background: "transparent", color: "#ef4444", border: "1px solid #ef4444"}} 
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>

              {/* Cartoon Selection */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>Choose a cartoon character:</span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {CARTOONS.map((cartoon) => {
                    const cartoonUrl = "data:image/svg+xml;utf8," + encodeURIComponent(cartoon.svg);
                    const isSelected = accountUser.customPhotoURL === cartoonUrl;
                    return (
                      <button
                        key={cartoon.name}
                        type="button"
                        style={{
                          padding: 0,
                          border: isSelected ? "3px solid var(--accent)" : "1.5px solid var(--border)",
                          background: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          transition: "all 150ms",
                          transform: isSelected ? "scale(1.1)" : "none",
                          backgroundColor: "var(--code-bg)"
                        }}
                        onClick={async () => {
                          try {
                            setAuthLoading(true);
                            localforage.setItem("profilePic_" + auth.currentUser.uid, cartoonUrl);
                            setUser((prev) => ({ ...prev, customPhotoURL: cartoonUrl }));
                            
                            if (db) {
                              const userRef = doc(db, "users", auth.currentUser.uid);
                              await setDoc(userRef, { customPhotoURL: cartoonUrl }, { merge: true });
                            }
                            setAuthMessage("Profile picture updated with cartoon!");
                          } catch (err) {
                            console.error("Error setting cartoon profile", err);
                          } finally {
                            setAuthLoading(false);
                          }
                        }}
                        title={cartoon.name}
                      >
                        <div dangerouslySetInnerHTML={{ __html: cartoon.svg }} style={{ width: "100%", height: "100%" }} />
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    style={{
                      ...styles.authSecondaryButton,
                      fontSize: "12px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "var(--accent)",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setAvatarBgColor("#fbcfe8");
                      setAvatarAccentColor("#db2777");
                      setAvatarAccessory("none");
                      setAvatarEyeSize(4);
                      setAvatarMouth("smile");
                      setAvatarBgImage(null);
                      setAvatarModalOpen(true);
                    }}
                  >
                    🎨 Create Character
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!accountUser.emailVerified && (
            <p style={styles.authNotice}>
              Your email is not verified yet. Verify it to protect the account
              and unlock full saved-list sync.
            </p>
          )}

          {/* Personalize Section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "16px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px" }}>✨</span>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-h)", margin: 0 }}>Personalize</h3>
            </div>

            {/* Theme selector */}
            {renderThemeSelector({ compact: true })}

            {/* Emoji preference */}
            <div style={{ background: "var(--code-bg)", borderRadius: "12px", padding: "14px 16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={disableEmojis}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setDisableEmojis(val);
                    if (auth.currentUser && db) {
                      try {
                        const userRef = doc(db, "users", auth.currentUser.uid);
                        await setDoc(userRef, { disableEmojis: val }, { merge: true });
                      } catch (err) {
                        console.error("Error saving emoji preference", err);
                      }
                    }
                  }}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent)" }}
                />
                <div>
                  <span style={{ fontSize: "14px", color: "var(--text)", fontWeight: "600", display: "block" }}>Remove all emojis</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted, var(--text))", opacity: 0.7 }}>Strip emojis from labels and buttons</span>
                </div>
              </label>
            </div>
          </div>

          <div style={styles.authActionRow}>
            {!accountUser.emailVerified && (
              <>
                <button
                  type="button"
                  style={styles.authSecondaryButton}
                  onClick={handleResendVerification}
                  disabled={authLoading || !isFirebaseConfigured}
                >
                  Resend verification
                </button>
                <button
                  type="button"
                  style={styles.authTextButton}
                  onClick={handleRefreshVerification}
                  disabled={authLoading || !isFirebaseConfigured}
                >
                  I verified, refresh
                </button>
              </>
            )}
          </div>

          {authMessage && <p style={styles.authMessage}>{authMessage}</p>}
        </section>
      );
    }

    return (
      <section style={styles.authPanel}>
        <div style={styles.authHeader}>
          <h2 style={styles.authTitle}>{isSignUp ? "Create account" : "Log in"}</h2>
          <p style={styles.authSubtitle}>
            Use Google single sign-on or create an email/password account to
            keep your saved books and filters synced.
          </p>
        </div>

        {!isFirebaseConfigured && (
          <p style={styles.authNotice}>
            Firebase is not configured yet. Add your Firebase web config in
            `.env.local`, then enable Authentication and Firestore.
          </p>
        )}

        {isAndroidApp && !isAndroidGoogleSsoConfigured && (
          <p style={styles.authNotice}>
            Phone Google SSO needs `android/app/google-services.json` and
            `VITE_ANDROID_GOOGLE_SSO_READY=true` before the Android build can sign in.
          </p>
        )}

        {accountUser && !accountUser.emailVerified && (
          <p style={styles.authNotice}>
            Your email is not verified yet. Verify it to protect the account and
            reduce spam signups.
          </p>
        )}

        <form style={styles.authForm} onSubmit={handleAuthSubmit}>
          {isSignUp && (
            <label style={styles.filterLabel}>
              <span>Name</span>
              <input
                style={styles.filterControl}
                value={authForm.name}
                placeholder="Reader name"
                autoComplete="name"
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                onChange={(event) => updateAuthForm("name", event.target.value)}
              />
            </label>
          )}

          <label style={styles.filterLabel}>
            <span>Email</span>
            <input
              style={styles.filterControl}
              value={authForm.email}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              onChange={(event) => updateAuthForm("email", event.target.value)}
            />
          </label>

          <label style={styles.filterLabel}>
            <span>Password</span>
            <input
              style={styles.filterControl}
              value={authForm.password}
              type="password"
              placeholder="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              onChange={(event) => updateAuthForm("password", event.target.value)}
            />
            {isSignUp && (
              <span style={styles.passwordHint}>
                At least 8 characters with an uppercase letter, a number, and a special character.
              </span>
            )}
          </label>

          {isSignUp && (
            <label style={styles.filterLabel}>
              <span>Confirm Password</span>
              <input
                style={styles.filterControl}
                value={authForm.confirmPassword}
                type="password"
                placeholder="Confirm Password"
                autoComplete="new-password"
                onChange={(event) => updateAuthForm("confirmPassword", event.target.value)}
              />
            </label>
          )}

          <button
            type="submit"
            style={styles.authPrimaryButton}
            disabled={authLoading || !isFirebaseConfigured}
          >
            {authLoading ? "Working..." : isSignUp ? "Create Account" : "Log In"}
          </button>
        </form>

        <div style={styles.authActionRow}>
          <button
            type="button"
            style={styles.googleSignInButton}
            onClick={handleGoogleLogin}
            disabled={authLoading || !isFirebaseConfigured}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
          <button
            type="button"
            style={styles.authTextButton}
            onClick={handleForgotPassword}
            disabled={authLoading || !isFirebaseConfigured}
          >
            Forgot password
          </button>
          {accountUser && !accountUser.emailVerified && (
            <>
              <button
                type="button"
                style={styles.authTextButton}
                onClick={handleResendVerification}
                disabled={authLoading || !isFirebaseConfigured}
              >
                Resend verification
              </button>
              <button
                type="button"
                style={styles.authTextButton}
                onClick={handleRefreshVerification}
                disabled={authLoading || !isFirebaseConfigured}
              >
                I verified, refresh
              </button>
            </>
          )}
        </div>

        <div style={styles.authFooter}>
          <button
            type="button"
            style={styles.authTextButton}
            onClick={() => {
              setAuthMode(isSignUp ? "signin" : "signup");
              setAuthMessage("");
            }}
          >
            {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>

        {authMessage && <p style={styles.authMessage}>{authMessage}</p>}
      </section>
    );
  };

  const renderAchievementsSection = () => {
    if (!accountUser) return null;

    const achievements = [
      {
        id: "first_scan",
        emoji: "🚀",
        title: "First Steps",
        description: "Scan or add your first book",
        unlocked: (savedFiles || []).length >= 1,
        progress: `${Math.min((savedFiles || []).length, 1)}/1`,
      },
      {
        id: "bookworm",
        emoji: "📚",
        title: "Bookworm",
        description: "Have 5 or more books saved in your stash",
        unlocked: (savedFiles || []).length >= 5,
        progress: `${Math.min((savedFiles || []).length, 5)}/5`,
      },
      {
        id: "super_organizer",
        emoji: "🏷️",
        title: "Super Organizer",
        description: "Create at least 1 custom folder to group your books",
        unlocked: (folders || []).length >= 1,
        progress: `${Math.min((folders || []).length, 1)}/1`,
      },
      {
        id: "reflection",
        emoji: "🎤",
        title: "Reflection",
        description: "Record a review or review a book",
        unlocked: Object.keys(reviews || {}).length >= 1,
        progress: `${Math.min(Object.keys(reviews || {}).length, 1)}/1`,
      },
    ];

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    // Weekly Goal Progress Calculations
    const weeklyGoalInt = parseInt(weeklyGoal, 10) || 3;
    const weeklyProgress = Math.min((savedFiles || []).length, weeklyGoalInt);
    const progressPercent = Math.round((weeklyProgress / weeklyGoalInt) * 100);

    return (
      <section
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "16px",
          marginTop: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        }}
      >
        <div
          onClick={() => setAchievementsOpen(!achievementsOpen)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "20px" }}>🏆</span>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text)", margin: 0 }}>
              Reading Achievements
            </h3>
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "var(--accent-glow)",
                color: "var(--accent)",
                padding: "2px 8px",
                borderRadius: "12px",
                fontWeight: "600",
              }}
            >
              {unlockedCount}/{achievements.length} Unlocked
            </span>
          </div>
          <span
            style={{
              fontSize: "14px",
              color: "var(--text-l)",
              transform: achievementsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          >
            ▼
          </span>
        </div>

        {achievementsOpen && (
          <div style={{ marginTop: "16px" }}>
            {/* Weekly Goal Selector & Progress Bar */}
            <div
              style={{
                backgroundColor: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                  🎯 Weekly Reading Goal:
                </span>
                <select
                  value={weeklyGoal}
                  onChange={(e) => handleWeeklyGoalChange(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--text)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  <option value="1">1 Book / week</option>
                  <option value="3">3 Books / week</option>
                  <option value="5">5 Books / week</option>
                  <option value="10">10 Books / week</option>
                </select>
              </div>

              {/* Goal Progress Bar */}
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "var(--border)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    backgroundColor: "var(--accent)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--text-l)",
                }}
              >
                <span>{progressPercent}% Complete</span>
                <span>
                  {weeklyProgress}/{weeklyGoalInt} Books
                </span>
              </div>
            </div>

            {/* Badges Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "12px",
              }}
            >
              {achievements.map((achievement) => {
                const isFeatured = featuredBadge === achievement.id;
                return (
                  <div
                    key={achievement.id}
                    onClick={() => {
                      if (achievement.unlocked) {
                        handleFeaturedBadgeChange(achievement.id);
                      }
                    }}
                    style={{
                      backgroundColor: "var(--bg)",
                      border: isFeatured
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                      borderRadius: "12px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      position: "relative",
                      cursor: achievement.unlocked ? "pointer" : "default",
                      boxShadow: isFeatured ? "0 0 10px var(--accent-glow)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isFeatured && (
                      <span
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          fontSize: "9px",
                          backgroundColor: "var(--accent)",
                          color: "#fff",
                          padding: "1px 4px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        Featured
                      </span>
                    )}
                    <div
                      style={{
                        fontSize: "32px",
                        marginBottom: "6px",
                        filter: achievement.unlocked ? "none" : "grayscale(100%) opacity(40%)",
                        transform: achievement.unlocked ? "scale(1.1)" : "scale(1)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      {achievement.emoji}
                    </div>
                    <h4
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text)",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {achievement.title}
                    </h4>
                    <p
                      style={{
                        fontSize: "10px",
                        color: "var(--text-l)",
                        margin: "0 0 8px 0",
                        lineHeight: "1.3",
                        flex: 1,
                      }}
                    >
                      {achievement.description}
                    </p>
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: "700",
                        color: achievement.unlocked ? "var(--accent)" : "var(--text-l)",
                        backgroundColor: achievement.unlocked
                          ? "var(--accent-glow)"
                          : "var(--border)",
                        padding: "2px 8px",
                        borderRadius: "8px",
                      }}
                    >
                      {achievement.progress}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      {renderAuthSection()}
      {renderAchievementsSection()}
      {renderLibraryCards()}
      {canOpenDeveloper && renderDeveloperPage()}
      <div style={{ marginTop: '32px', textAlign: 'center', color: 'var(--text-l)', fontSize: '12px', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a
            href="https://luminapro.web.app/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-l)', textDecoration: 'underline' }}
          >
            Privacy Policy
          </a>
          <a
            href="https://luminapro.web.app/terms-of-service.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-l)', textDecoration: 'underline' }}
          >
            Terms of Service
          </a>
          <a
            href="mailto:luminapr.antigravity@gmail.com"
            style={{ color: 'var(--text-l)', textDecoration: 'underline' }}
          >
            Contact Support
          </a>
          <a
            href="https://shilpi-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-l)', textDecoration: 'underline' }}
          >
            About Developer
          </a>
        </div>
        <div style={{ marginTop: '8px' }}>&copy; 2026 Shilpi Sharma. All rights reserved.</div>
      </div>
    </>
  );
}
