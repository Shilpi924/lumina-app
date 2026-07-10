import { useState, useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  OAuthProvider,
  sendPasswordResetEmail,
  reload,
  getRedirectResult,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, analytics, logEvent } from "../firebase";
import { recordSuccessfulLogin } from "../services/firebaseService";
import { getAuthErrorMessage, sanitizeDisplayName } from "../utils/stringUtils";
import { isValidEmail, validateDisplayName, validatePassword } from "../utils/validationUtils";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import localforage from "localforage";

export function useAuth({ setCurrentPage }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  
  const userDataLoadedRef = useRef(false);

  const isNativeApp = Capacitor.isNativePlatform();
  const isAndroidApp = Capacitor.getPlatform() === "android";
  const hasNativeFirebaseAuthentication = Capacitor.isPluginAvailable("FirebaseAuthentication");
  const isAndroidGoogleSsoConfigured = import.meta.env.VITE_ANDROID_GOOGLE_SSO_READY === "true";

  useEffect(() => {
    if (!auth || !db) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      userDataLoadedRef.current = false;

      if (!firebaseUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      if (firebaseUser.isAnonymous) {
        setUser(firebaseUser);
        userDataLoadedRef.current = true;
        setAuthReady(true);
        return;
      }
      if (!firebaseUser.emailVerified) {
        await signOut(auth);
        setUser(null);
        setAuthReady(true);
        setAuthMode("signin");
        setAuthMessage("Please verify your email before logging in.");
        return;
      }

      const customPhotoURL = await localforage.getItem("profilePic_" + firebaseUser.uid);
      setUser({ ...firebaseUser, customPhotoURL });
      setAuthReady(true);
      // The rest of the sync logic will be handled by useAppSync
    });
  }, []);

  useEffect(() => {
    if (!auth || !db) return undefined;

    let isMounted = true;

    getRedirectResult(auth)
      .then(async (credential) => {
        if (!credential?.user || !isMounted) return;

        await recordSuccessfulLogin(credential.user, "google");
        logEvent(analytics, "login", { method: "google-redirect" });
        setAuthMessage("Signed in with Google.");
        setCurrentPage("scan");
      })
      .catch((err) => {
        console.error("Google redirect sign-in failed:", err);
        if (isMounted) {
          setAuthMessage(getAuthErrorMessage(err));
          setCurrentPage("account");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!auth || !db) {
      setAuthMessage("Add your Firebase config and enable Authentication first.");
      return;
    }

    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const displayName = sanitizeDisplayName(authForm.name);

    if (!email || !password) {
      setAuthMessage("Enter your email and password.");
      return;
    }
    if (!isValidEmail(email)) {
      setAuthMessage("Enter a valid email address.");
      return;
    }
    if (authMode === "signup") {
      const nameError = validateDisplayName(displayName);
      if (nameError) {
        setAuthMessage(nameError);
        return;
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        setAuthMessage(passwordError);
        return;
      }
      if (password !== authForm.confirmPassword) {
        setAuthMessage("Passwords do not match.");
        return;
      }
    }

    setAuthLoading(true);
    setAuthMessage("");

    try {
      const credential =
        authMode === "signup"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      if (authMode === "signup") {
        await updateProfile(credential.user, {
          displayName,
        });
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setUser(null);
        setAuthMode("signin");
        setAuthMessage("Verification email sent. Please verify your email, then log in.");
        return;
      }

      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setUser(null);
        setAuthMode("signin");
        setAuthMessage("Your email is not verified. I sent a new verification email. Please verify, then log in.");
        return;
      }

      await recordSuccessfulLogin(
        {
          ...credential.user,
          displayName: displayName || credential.user.displayName,
        },
        "email"
      );
      logEvent(analytics, "login", {
        method: "email",
      });
      setAuthMessage("Signed in. Your saved list and filters will sync here.");
      setCurrentPage("scan");
    } catch (err) {
      console.error("Auth failed:", err);
      setAuthMessage(getAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!auth || !db) {
      setAuthMessage("Add your Firebase config and enable Authentication first.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    if (isAndroidApp && !isAndroidGoogleSsoConfigured) {
      setAuthLoading(false);
      setAuthMessage(
        "Google SSO needs the Android Firebase config. Add android/app/google-services.json, set VITE_ANDROID_GOOGLE_SSO_READY=true, rebuild, then try again."
      );
      return;
    }

    async function signInWithGoogleWeb() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });
      const credential = await signInWithPopup(auth, provider);
      await recordSuccessfulLogin(credential.user, "google");
      logEvent(analytics, "login", { method: "google" });
      setAuthMessage("Signed in with Google.");
      setCurrentPage("scan");
    }

    async function redirectToGoogleSignIn() {
      setAuthMessage("Opening Google sign-in in this tab...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });
      await signInWithRedirect(auth, provider);
    }

    try {
      if (isNativeApp && hasNativeFirebaseAuthentication) {
        const nativeResult = await FirebaseAuthentication.signInWithGoogle({
          skipNativeAuth: true,
        });
        const idToken = nativeResult.credential?.idToken || null;
        const accessToken = nativeResult.credential?.accessToken || undefined;

        if (!idToken && !accessToken) {
          throw new Error(
            "Google sign-in did not return a Firebase credential. Check the Android Firebase client setup."
          );
        }

        const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
        const credential = await signInWithCredential(auth, googleCredential);

        await recordSuccessfulLogin(credential.user, "google");
        logEvent(analytics, "login", { method: "google-native" });
        setAuthMessage("Signed in with Google.");
        setCurrentPage("scan");
        return;
      }

      if (!isNativeApp) {
        await signInWithGoogleWeb();
        return;
      }

      setAuthMessage(
        "Google SSO must use native sign-in in the phone app. Add android/app/google-services.json, set VITE_ANDROID_GOOGLE_SSO_READY=true, rebuild, then try again."
      );
    } catch (err) {
      console.error("Google sign-in failed:", err);
      const code = err?.code || "";
      const message = String(err?.message || "");
      if (
        message.includes("FirebaseAuthentication") &&
        message.includes("not implemented")
      ) {
        if (isAndroidApp) {
          setAuthMessage(
            "Google SSO needs the Android Firebase config. Add android/app/google-services.json, set VITE_ANDROID_GOOGLE_SSO_READY=true, rebuild, then try again."
          );
          return;
        }

        try {
          await signInWithGoogleWeb();
          return;
        } catch (fallbackErr) {
          console.error("Google web fallback sign-in failed:", fallbackErr);
          if (String(fallbackErr?.code || "").includes("popup")) {
            await redirectToGoogleSignIn();
            return;
          }
          setAuthMessage(getAuthErrorMessage(fallbackErr));
          return;
        }
      }
      if (
        code.includes("popup-blocked") ||
        code.includes("popup-closed-by-user") ||
        code.includes("cancelled-popup-request") ||
        code.includes("web-storage-unsupported")
      ) {
        if (isAndroidApp) {
          setAuthMessage(
            "Google SSO must use native Android sign-in. Add android/app/google-services.json, set VITE_ANDROID_GOOGLE_SSO_READY=true, rebuild, then try again."
          );
          return;
        }

        await redirectToGoogleSignIn();
        return;
      }

      setAuthMessage(getAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAppleLogin() {
    if (!auth) {
      setAuthMessage("Add your Firebase config and enable Authentication first.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    async function signInWithAppleWeb() {
      const provider = new OAuthProvider("apple.com");
      const credential = await signInWithPopup(auth, provider);
      await recordSuccessfulLogin(credential.user, "apple");
      logEvent(analytics, "login", { method: "apple" });
      setAuthMessage("Signed in with Apple.");
      setCurrentPage("scan");
    }

    async function redirectToAppleSignIn() {
      setAuthMessage("Opening Apple sign-in in this tab...");
      const provider = new OAuthProvider("apple.com");
      await signInWithRedirect(auth, provider);
    }

    try {
      if (isNativeApp && hasNativeFirebaseAuthentication) {
        const nativeResult = await FirebaseAuthentication.signInWithApple({
          skipNativeAuth: true,
        });
        const idToken = nativeResult.credential?.idToken || null;
        const accessToken = nativeResult.credential?.accessToken || undefined;
        const rawNonce = nativeResult.credential?.nonce || undefined;

        if (!idToken) {
          throw new Error(
            "Apple sign-in did not return a Firebase credential. Check the App setup."
          );
        }

        const provider = new OAuthProvider("apple.com");
        const appleCredential = provider.credential({
          idToken,
          accessToken,
          rawNonce,
        });
        const credential = await signInWithCredential(auth, appleCredential);

        await recordSuccessfulLogin(credential.user, "apple");
        logEvent(analytics, "login", { method: "apple-native" });
        setAuthMessage("Signed in with Apple.");
        setCurrentPage("scan");
        return;
      }

      if (!isNativeApp) {
        await signInWithAppleWeb();
        return;
      }

      setAuthMessage("Apple SSO must use native sign-in in the phone app.");
    } catch (err) {
      console.error("Apple sign-in failed:", err);
      const code = err?.code || "";
      const message = String(err?.message || "");
      
      if (
        message.includes("FirebaseAuthentication") &&
        message.includes("not implemented")
      ) {
        try {
          await signInWithAppleWeb();
          return;
        } catch (fallbackErr) {
          console.error("Apple web fallback sign-in failed:", fallbackErr);
          if (String(fallbackErr?.code || "").includes("popup")) {
            await redirectToAppleSignIn();
            return;
          }
          setAuthMessage(getAuthErrorMessage(fallbackErr));
          return;
        }
      }
      if (
        code.includes("popup-blocked") ||
        code.includes("popup-closed-by-user") ||
        code.includes("cancelled-popup-request") ||
        code.includes("web-storage-unsupported")
      ) {
        await redirectToAppleSignIn();
        return;
      }

      setAuthMessage(getAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!auth) {
      setAuthMessage("Add your Firebase config and enable Authentication first.");
      return;
    }

    const email = authForm.email.trim().toLowerCase();
    if (!email) {
      setAuthMessage("Enter your email first, then click Forgot password.");
      return;
    }
    if (!isValidEmail(email)) {
      setAuthMessage("Enter a valid email address for password reset.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    try {
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin,
        handleCodeInApp: false,
      });
      setAuthMessage(
        `Password reset email sent to ${email}. Check spam or promotions if it does not show up in a minute.`
      );
    } catch (err) {
      console.error("Password reset failed:", err);
      setAuthMessage(getAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!user) {
      setAuthMessage("Log in first, then request a verification email.");
      return;
    }
    if (user.emailVerified) {
      setAuthMessage("Your email is already verified.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    try {
      await sendEmailVerification(user);
      await signOut(auth);
      setUser(null);
      setAuthMode("signin");
      setAuthMessage("Verification email sent. Please verify your email, then log in.");
    } catch (err) {
      console.error("Email verification failed:", err);
      setAuthMessage(getAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRefreshVerification() {
    if (!auth?.currentUser) return;

    setAuthLoading(true);
    setAuthMessage("");

    try {
      await reload(auth.currentUser);
      const refreshedUser = auth.currentUser;
      setUser(refreshedUser);
      if (refreshedUser?.uid && db) {
        await setDoc(
          doc(db, "users", refreshedUser.uid),
          {
            emailVerified: Boolean(refreshedUser.emailVerified),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      setAuthMessage(
        refreshedUser?.emailVerified
          ? "Email verified. Thank you."
          : "Email is not verified yet."
      );
    } catch (err) {
      console.error("Refresh verification failed:", err);
      setAuthMessage("Could not refresh verification status.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;

    try {
      await signOut(auth);
      setAuthMessage("Signed out. You can keep browsing as a guest.");
    } catch (err) {
      console.error("Sign out failed:", err);
      setAuthMessage("Could not sign out. Please try again.");
    }
  }

  return {
    user,
    setUser,
    authReady,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    authMessage,
    setAuthMessage,
    authLoading,
    setAuthLoading,
    handleAuthSubmit,
    handleGoogleLogin,
    handleAppleLogin,
    handleForgotPassword,
    handleResendVerification,
    handleRefreshVerification,
    handleSignOut,
    userDataLoadedRef,
  };
}
