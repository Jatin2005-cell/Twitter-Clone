"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";
import { requestNotificationPermission } from "@/lib/notification";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  website: string;
  location: string;
  notificationsEnabled: boolean;
  phoneNumber?: string;

  preferredLanguage?: "en" | "hi" | "es" | "pt" | "fr" | "zh";

  otpPending?: boolean;
  otpEmail?: string;

  loginHistory?: {
    browser: string;
    operatingSystem: string;
    deviceType: string;
    ipAddress: string;
    loginTime: string;
  }[];
}

interface AuthContextType {
  user: User | null;

  login: (
    email: string,
    password: string
  ) => Promise<{
    requireOtp: boolean;
    email?: string;
  }>;

  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<void>;

  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    notificationsEnabled: boolean;
    phoneNumber: string;
  }) => Promise<void>;

  logout: () => Promise<void>;

  isLoading: boolean;

  googlesignin: () => Promise<void>;

  setAuthenticatedUser: (user: User) => void;

  updatePreferredLanguage: (
    language: "en" | "hi" | "es" | "pt" | "fr" | "zh"
  ) => void;

  otpPending: boolean;
  otpEmail: string;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
};

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [otpPending, setOtpPending] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  /*
   * This ref is important.
   *
   * Firebase can restore its session before React finishes
   * restoring localStorage. Therefore we keep the pending
   * OTP email in a ref as well.
   */
  const pendingOtpEmailRef = useRef<string | null>(null);

  /*
   * Prevent Firebase listener from restoring backend user
   * while login OTP is still pending.
   */
  const otpVerifiedRef = useRef(false);

  // =====================================================
  // STORAGE HELPERS
  // =====================================================

  const saveOtpPending = (email: string) => {
    if (typeof window === "undefined") return;

    const cleanEmail = email.trim().toLowerCase();

    localStorage.setItem("otp-pending", "true");
    localStorage.setItem("otp-email", cleanEmail);

    /*
     * sessionStorage is additional protection for the current
     * browser tab.
     */
    sessionStorage.setItem("otp-pending", "true");
    sessionStorage.setItem("otp-email", cleanEmail);

    console.log(
      "💾 OTP pending state saved:",
      cleanEmail
    );
  };

  const clearOtpPending = () => {
    if (typeof window === "undefined") return;

    localStorage.removeItem("otp-pending");
    localStorage.removeItem("otp-email");

    sessionStorage.removeItem("otp-pending");
    sessionStorage.removeItem("otp-email");

    console.log("🧹 OTP pending state cleared");
  };

  const getSavedOtpEmail = (): string | null => {
    if (typeof window === "undefined") {
      return null;
    }

    /*
     * Check localStorage first.
     */
    const localPending =
      localStorage.getItem("otp-pending");

    const localEmail =
      localStorage.getItem("otp-email");

    if (
      localPending === "true" &&
      localEmail
    ) {
      return localEmail.trim().toLowerCase();
    }

    /*
     * Fallback to sessionStorage.
     */
    const sessionPending =
      sessionStorage.getItem("otp-pending");

    const sessionEmail =
      sessionStorage.getItem("otp-email");

    if (
      sessionPending === "true" &&
      sessionEmail
    ) {
      return sessionEmail.trim().toLowerCase();
    }

    return null;
  };

  // =====================================================
  // FIREBASE AUTH STATE
  // =====================================================

  useEffect(() => {
    let mounted = true;

    /*
     * IMPORTANT:
     *
     * Restore OTP state synchronously before Firebase
     * listener starts doing backend authentication.
     */
    const savedOtpEmail = getSavedOtpEmail();

    if (savedOtpEmail) {
      console.log(
        "⏳ Restoring OTP pending state:",
        savedOtpEmail
      );

      pendingOtpEmailRef.current =
        savedOtpEmail;

      otpVerifiedRef.current = false;

      setOtpPending(true);
      setOtpEmail(savedOtpEmail);
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!mounted) return;

        console.log(
          "🔥 Firebase auth state:",
          firebaseUser?.email ||
            "logged out"
        );

        const pendingEmail =
          pendingOtpEmailRef.current ||
          getSavedOtpEmail();

        /*
         * =================================================
         * OTP PENDING HAS HIGHEST PRIORITY
         * =================================================
         */

        if (
          firebaseUser?.email &&
          pendingEmail &&
          !otpVerifiedRef.current &&
          firebaseUser.email
            .trim()
            .toLowerCase() ===
            pendingEmail
              .trim()
              .toLowerCase()
        ) {
          console.log(
            "⏳ OTP pending detected."
          );

          console.log(
            "🚫 Skipping automatic backend authentication."
          );

          pendingOtpEmailRef.current =
            pendingEmail;

          setOtpEmail(
            firebaseUser.email
          );

          setOtpPending(true);

          /*
           * VERY IMPORTANT:
           *
           * User must NOT be set here.
           */
          setUser(null);

          setIsLoading(false);

          return;
        }

        /*
         * =================================================
         * NO FIREBASE USER
         * =================================================
         */

        if (!firebaseUser) {
          console.log(
            "🚪 No Firebase user"
          );

          setUser(null);

          pendingOtpEmailRef.current =
            null;

          otpVerifiedRef.current =
            false;

          setOtpPending(false);
          setOtpEmail("");

          clearOtpPending();

          if (typeof window !== "undefined") {
            localStorage.removeItem(
              "twitter-user"
            );
          }

          setIsLoading(false);

          return;
        }

        /*
         * =================================================
         * NORMAL EXISTING SESSION
         * =================================================
         *
         * This only runs when OTP is NOT pending.
         */

        try {
          await requestNotificationPermission();

          const res =
            await axiosInstance.get(
              "/loggedinuser",
              {
                params: {
                  email:
                    firebaseUser.email,
                  uid:
                    firebaseUser.uid,
                },
              }
            );

          if (!mounted) return;

          const backendUser =
            res.data?.user ||
            res.data;

          if (backendUser?._id) {
            console.log(
              "✅ Existing Firebase session restored"
            );

            setUser(backendUser);

            if (
              typeof window !== "undefined"
            ) {
              localStorage.setItem(
                "twitter-user",
                JSON.stringify(
                  backendUser
                )
              );
            }
          }
        } catch (error) {
          console.error(
            "❌ Existing session restore failed:",
            error
          );

          setUser(null);
        }

        if (mounted) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // =====================================================
  // LOGIN
  // =====================================================

  const login = async (
    email: string,
    password: string
  ): Promise<{
    requireOtp: boolean;
    email?: string;
  }> => {
    setIsLoading(true);

    const cleanEmail =
      email.trim().toLowerCase();

    try {
      if (!cleanEmail || !password) {
        throw new Error(
          "Email and password are required."
        );
      }

      /*
       * =================================================
       * SET OTP PENDING BEFORE FIREBASE LOGIN
       * =================================================
       *
       * This prevents Firebase's auth listener from
       * immediately opening the dashboard.
       */

      pendingOtpEmailRef.current =
        cleanEmail;

      otpVerifiedRef.current = false;

      setUser(null);

      setOtpEmail(cleanEmail);
      setOtpPending(true);

      saveOtpPending(cleanEmail);

      console.log(
        "⏳ OTP flow initialized for:",
        cleanEmail
      );

      /*
       * =================================================
       * FIREBASE LOGIN
       * =================================================
       */

      console.log(
        "🔐 Starting Firebase password login..."
      );

      const usercred =
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      const firebaseUser =
        usercred.user;

      if (!firebaseUser.email) {
        throw new Error(
          "Email not found in Firebase account."
        );
      }

      console.log(
        "🔥 Firebase login successful:",
        firebaseUser.email
      );

      /*
       * =================================================
       * BACKEND USER CHECK
       * =================================================
       */

      const browserName =
        typeof navigator !== "undefined"
          ? navigator.userAgent
          : "Unknown";

      const res =
        await axiosInstance.get(
          "/loggedinuser",
          {
            params: {
              email:
                firebaseUser.email,
              uid:
                firebaseUser.uid,
              browser:
                browserName,
            },
          }
        );

      console.log(
        "✅ Backend login response:",
        res.data
      );

      const backendUser =
        res.data?.user ||
        res.data;

      if (!backendUser?._id) {
        throw new Error(
          "User profile not found. Please register this account first."
        );
      }

      console.log(
        "✅ User profile validated:",
        backendUser.email
      );

      /*
       * =================================================
       * LOGIN HISTORY
       * =================================================
       */

      try {
        await axiosInstance.post(
          "/login-history",
          {
            email:
              firebaseUser.email,
            browser:
              browserName,
          }
        );

        console.log(
          "✅ Login history saved"
        );
      } catch (historyError: any) {
        console.warn(
          "⚠️ Login history failed:",
          historyError?.response
            ?.data ||
            historyError?.message
        );
      }

      /*
       * =================================================
       * SEND LOGIN OTP
       * =================================================
       */

      console.log(
        "📧 Sending login OTP..."
      );

      const otpResponse =
        await axiosInstance.post(
          "/send-login-otp",
          {
            email:
              firebaseUser.email,
          }
        );

      console.log(
        "📧 Login OTP API response:",
        otpResponse.data
      );

      if (
        otpResponse.data?.success === false
      ) {
        throw new Error(
          otpResponse.data?.message ||
            "Failed to send login OTP."
        );
      }

      console.log(
        "✅ Login OTP sent successfully"
      );

      /*
       * =================================================
       * SAVE OTP STATE AGAIN
       * =================================================
       *
       * We do this AFTER the API succeeds as well.
       */

      pendingOtpEmailRef.current =
        firebaseUser.email
          .trim()
          .toLowerCase();

      otpVerifiedRef.current = false;

      setUser(null);

      setOtpEmail(
        firebaseUser.email
      );

      setOtpPending(true);

      saveOtpPending(
        firebaseUser.email
      );

      console.log(
        "📧 OTP popup should now be visible"
      );

      /*
       * =================================================
       * RETURN
       * =================================================
       */

      return {
        requireOtp: true,
        email:
          firebaseUser.email,
      };
    } catch (error: any) {
      console.error(
        "🔥 LOGIN ERROR:",
        error?.response?.data ||
          error?.message ||
          error
      );

      /*
       * Clear OTP state on genuine login failure.
       */

      pendingOtpEmailRef.current =
        null;

      otpVerifiedRef.current =
        false;

      setOtpPending(false);
      setOtpEmail("");

      clearOtpPending();

      setUser(null);

      try {
        await signOut(auth);
      } catch (signOutError) {
        console.warn(
          "Firebase signout after login error:",
          signOutError
        );
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // OTP VERIFIED
  // =====================================================

  const setAuthenticatedUser = (
    authenticatedUser: User
  ) => {
    console.log(
      "🎉 OTP VERIFIED - AUTHENTICATING USER"
    );

    /*
     * IMPORTANT:
     *
     * Mark OTP verified BEFORE changing user state.
     * This prevents Firebase listener from treating the
     * authenticated Firebase session as OTP-pending.
     */

    otpVerifiedRef.current = true;

    pendingOtpEmailRef.current =
      null;

    /*
     * Clear OTP state first.
     */

    setOtpPending(false);
    setOtpEmail("");

    clearOtpPending();

    /*
     * Now authenticate backend user.
     */

    setUser(authenticatedUser);

    if (
      typeof window !== "undefined"
    ) {
      localStorage.setItem(
        "twitter-user",
        JSON.stringify(
          authenticatedUser
        )
      );
    }

    console.log(
      "✅ USER AUTHENTICATED:",
      authenticatedUser.email
    );
  };

  // =====================================================
  // SIGNUP
  // =====================================================

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    setIsLoading(true);

    try {
      const usercred =
        await createUserWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password
        );

      const firebaseUser =
        usercred.user;

      const newuser = {
        username,
        displayName,

        avatar:
          firebaseUser.photoURL ||
          "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",

        email:
          firebaseUser.email,

        uid:
          firebaseUser.uid,
      };

      const res =
        await axiosInstance.post(
          "/register",
          newuser
        );

      const backendUser =
        res.data?.user ||
        res.data;

      if (!backendUser?._id) {
        throw new Error(
          "Registration failed: user data not returned."
        );
      }

      setUser(backendUser);

      if (
        typeof window !== "undefined"
      ) {
        localStorage.setItem(
          "twitter-user",
          JSON.stringify(
            backendUser
          )
        );
      }
    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = async () => {
    try {
      console.log(
        "🚪 Starting logout..."
      );

      pendingOtpEmailRef.current =
        null;

      otpVerifiedRef.current =
        false;

      setOtpPending(false);
      setOtpEmail("");

      clearOtpPending();

      setUser(null);

      if (
        typeof window !== "undefined"
      ) {
        localStorage.removeItem(
          "twitter-user"
        );
      }

      await signOut(auth);

      console.log(
        "✅ Logout successful"
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  };

  // =====================================================
  // UPDATE LANGUAGE
  // =====================================================

  const updatePreferredLanguage = (
    language:
      | "en"
      | "hi"
      | "es"
      | "pt"
      | "fr"
      | "zh"
  ) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      preferredLanguage:
        language,
    };

    setUser(updatedUser);

    if (
      typeof window !== "undefined"
    ) {
      localStorage.setItem(
        "twitter-user",
        JSON.stringify(
          updatedUser
        )
      );
    }
  };

  // =====================================================
  // UPDATE PROFILE
  // =====================================================

  const updateProfile = async (
    profileData: {
      displayName: string;
      bio: string;
      location: string;
      website: string;
      avatar: string;
      notificationsEnabled: boolean;
      phoneNumber: string;
    }
  ) => {
    if (!user) return;

    setIsLoading(true);

    try {
      const updatedUser: User = {
        ...user,
        ...profileData,
      };

      const res =
        await axiosInstance.patch(
          `/userupdate/${user.email}`,
          updatedUser
        );

      if (res.data) {
        const backendUser =
          res.data?.user ||
          res.data;

        const finalUser = {
          ...updatedUser,
          ...backendUser,
        };

        setUser(finalUser);

        if (
          typeof window !== "undefined"
        ) {
          localStorage.setItem(
            "twitter-user",
            JSON.stringify(
              finalUser
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "Profile update error:",
        error
      );

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // GOOGLE LOGIN
  // =====================================================

  const googlesignin = async () => {
    setIsLoading(true);

    try {
      const googleauthprovider =
        new GoogleAuthProvider();

      const result =
        await signInWithPopup(
          auth,
          googleauthprovider
        );

      const firebaseuser =
        result.user;

      if (!firebaseuser.email) {
        throw new Error(
          "No email found in Google account"
        );
      }

      let userData: any = null;

      try {
        const res =
          await axiosInstance.get(
            "/loggedinuser",
            {
              params: {
                email:
                  firebaseuser.email,
                uid:
                  firebaseuser.uid,
              },
            }
          );

        userData =
          res.data?.user ||
          res.data;
      } catch {
        console.log(
          "Google user not found. Creating user..."
        );
      }

      if (!userData?._id) {
        const newuser = {
          username:
            firebaseuser.email.split(
              "@"
            )[0],

          displayName:
            firebaseuser.displayName ||
            "User",

          avatar:
            firebaseuser.photoURL ||
            "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",

          email:
            firebaseuser.email,

          uid:
            firebaseuser.uid,
        };

        const registerRes =
          await axiosInstance.post(
            "/register",
            newuser
          );

        userData =
          registerRes.data?.user ||
          registerRes.data;
      }

      if (!userData?._id) {
        throw new Error(
          "Login/Register failed: No user data returned"
        );
      }

      setUser(userData);

      if (
        typeof window !== "undefined"
      ) {
        localStorage.setItem(
          "twitter-user",
          JSON.stringify(
            userData
          )
        );
      }

      console.log(
        "Google login successful:",
        userData
      );
    } catch (error: any) {
      console.error(
        "Google Sign-In Error:",
        error
      );

      alert(
        error.response?.data
          ?.message ||
          error.message ||
          "Login failed"
      );

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // PROVIDER
  // =====================================================

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
        updatePreferredLanguage,
        setAuthenticatedUser,
        otpPending,
        otpEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};