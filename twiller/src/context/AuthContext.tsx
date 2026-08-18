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

  otpPending: boolean;
  otpEmail: string;

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

  // =====================================================
  // OTP PENDING REF
  // =====================================================

  const pendingOtpEmailRef = useRef<string | null>(null);

  // =====================================================
  // OTP LOCAL STORAGE HELPERS
  // =====================================================

  const saveOtpPending = (email: string) => {
    if (typeof window === "undefined") return;

    localStorage.setItem("otp-pending", "true");
    localStorage.setItem("otp-email", email);
  };

  const clearOtpPending = () => {
    if (typeof window === "undefined") return;

    localStorage.removeItem("otp-pending");
    localStorage.removeItem("otp-email");
  };

  // =====================================================
  // FIREBASE AUTH STATE
  // =====================================================

  useEffect(() => {
    // -----------------------------------------------------
    // RESTORE OTP PENDING STATE FIRST
    // -----------------------------------------------------

    if (typeof window !== "undefined") {
      const savedOtpPending =
        localStorage.getItem("otp-pending");

      const savedOtpEmail =
        localStorage.getItem("otp-email");

      if (
        savedOtpPending === "true" &&
        savedOtpEmail
      ) {
        console.log(
          "⏳ Restoring OTP pending state:",
          savedOtpEmail
        );

        pendingOtpEmailRef.current =
          savedOtpEmail;

        setOtpPending(true);
        setOtpEmail(savedOtpEmail);
      }
    }

    // -----------------------------------------------------
    // FIREBASE LISTENER
    // -----------------------------------------------------

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log(
          "🔥 Firebase auth state:",
          firebaseUser?.email || "logged out"
        );

        // =================================================
        // OTP VERIFICATION PENDING
        // =================================================

        const pendingEmail =
          pendingOtpEmailRef.current;

        if (
          firebaseUser?.email &&
          pendingEmail &&
          firebaseUser.email.toLowerCase() ===
            pendingEmail.toLowerCase()
        ) {
          console.log(
            "⏳ OTP verification pending. Skipping normal auth."
          );

          setOtpPending(true);
          setOtpEmail(firebaseUser.email);

          setIsLoading(false);

          return;
        }

        // =================================================
        // EXTRA SAFETY:
        // CHECK LOCAL STORAGE OTP STATE
        // =================================================

        if (
          typeof window !== "undefined" &&
          firebaseUser?.email
        ) {
          const savedOtpPending =
            localStorage.getItem(
              "otp-pending"
            );

          const savedOtpEmail =
            localStorage.getItem(
              "otp-email"
            );

          if (
            savedOtpPending === "true" &&
            savedOtpEmail &&
            firebaseUser.email.toLowerCase() ===
              savedOtpEmail.toLowerCase()
          ) {
            console.log(
              "⏳ OTP pending restored from localStorage. Skipping normal auth."
            );

            pendingOtpEmailRef.current =
              savedOtpEmail;

            setOtpPending(true);
            setOtpEmail(savedOtpEmail);

            setIsLoading(false);

            return;
          }
        }

        // =================================================
        // NO FIREBASE USER
        // =================================================

        if (!firebaseUser) {
          setUser(null);

          pendingOtpEmailRef.current = null;

          setOtpPending(false);
          setOtpEmail("");

          if (typeof window !== "undefined") {
            localStorage.removeItem(
              "twitter-user"
            );

            clearOtpPending();
          }

          setIsLoading(false);

          return;
        }

        // =================================================
        // EXISTING AUTHENTICATED SESSION
        // =================================================

        try {
          await requestNotificationPermission();

          const res =
            await axiosInstance.get(
              "/loggedinuser",
              {
                params: {
                  email: firebaseUser.email,
                  uid: firebaseUser.uid,
                },
              }
            );

          const backendUser =
            res.data?.user || res.data;

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
        }

        setIsLoading(false);
      }
    );

    return () => {
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

      // -------------------------------------------------
      // IMPORTANT:
      // Set BEFORE Firebase login.
      // -------------------------------------------------

      pendingOtpEmailRef.current =
        cleanEmail;

      console.log(
        "🔐 Starting Firebase password login..."
      );

      // -------------------------------------------------
      // FIREBASE LOGIN
      // -------------------------------------------------

      const usercred =
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      const firebaseUser =
        usercred.user;

      if (!firebaseUser.email) {
        pendingOtpEmailRef.current =
          null;

        clearOtpPending();

        await signOut(auth);

        throw new Error(
          "Email not found in Firebase account."
        );
      }

      console.log(
        "✅ Firebase login successful:",
        firebaseUser.email
      );

      // -------------------------------------------------
      // BACKEND USER CHECK
      // -------------------------------------------------

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
              uid: firebaseUser.uid,
              browser: browserName,
            },
          }
        );

      console.log(
        "✅ Backend login response:",
        res.data
      );

      const backendUser =
        res.data?.user || res.data;

      // -------------------------------------------------
      // VALIDATE BACKEND USER
      // -------------------------------------------------

      if (!backendUser?._id) {
        pendingOtpEmailRef.current =
          null;

        clearOtpPending();

        await signOut(auth);

        setUser(null);

        if (
          typeof window !== "undefined"
        ) {
          localStorage.removeItem(
            "twitter-user"
          );
        }

        throw new Error(
          "User profile not found. Please register this account first."
        );
      }

      console.log(
        "✅ User profile validated:",
        backendUser.email
      );

      // -------------------------------------------------
      // LOGIN HISTORY
      // -------------------------------------------------

      try {
        await axiosInstance.post(
          "/login-history",
          {
            email:
              firebaseUser.email,
            browser: browserName,
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

      // -------------------------------------------------
      // SEND LOGIN OTP
      // -------------------------------------------------

      await axiosInstance.post(
        "/send-login-otp",
        {
          email:
            firebaseUser.email,
        }
      );

      console.log(
        "📧 Login OTP sent successfully"
      );

      // -------------------------------------------------
      // SAVE OTP PENDING STATE
      // -------------------------------------------------

      pendingOtpEmailRef.current =
        firebaseUser.email;

      setOtpEmail(
        firebaseUser.email
      );

      setOtpPending(true);

      // IMPORTANT:
      // Persist because deployed page refresh
      // destroys React state.

      saveOtpPending(
        firebaseUser.email
      );

      console.log(
        "⏳ OTP pending state saved"
      );

      // -------------------------------------------------
      // RETURN OTP REQUIREMENT
      // -------------------------------------------------

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

      // -------------------------------------------------
      // CANCEL OTP STATE
      // -------------------------------------------------

      pendingOtpEmailRef.current =
        null;

      setOtpPending(false);
      setOtpEmail("");

      clearOtpPending();

      try {
        await signOut(auth);
      } catch {}

      setUser(null);

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

    // -------------------------------------------------
    // REMOVE OTP PENDING STATE
    // -------------------------------------------------

    pendingOtpEmailRef.current =
      null;

    setOtpPending(false);
    setOtpEmail("");

    clearOtpPending();

    // -------------------------------------------------
    // AUTHENTICATE USER
    // -------------------------------------------------

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
        res.data?.user || res.data;

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
      pendingOtpEmailRef.current =
        null;

      setOtpPending(false);
      setOtpEmail("");

      clearOtpPending();

      setUser(null);

      await signOut(auth);

      if (
        typeof window !== "undefined"
      ) {
        localStorage.removeItem(
          "twitter-user"
        );
      }

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