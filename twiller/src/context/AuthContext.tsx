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
  // OTP PENDING STATE
  // =====================================================

  const pendingOtpEmailRef = useRef<string | null>(null);

  // =====================================================
  // FIREBASE AUTH STATE
  // =====================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log(
          "🔥 Firebase auth state:",
          firebaseUser?.email || "logged out"
        );

        // -------------------------------------------------
        // IMPORTANT:
        // Firebase password login is complete,
        // BUT application login is NOT complete until OTP.
        // -------------------------------------------------

        if (
          firebaseUser?.email &&
          pendingOtpEmailRef.current &&
          firebaseUser.email.toLowerCase() ===
            pendingOtpEmailRef.current.toLowerCase()
        ) {
          console.log(
            "⏳ OTP verification pending. Skipping normal auth."
          );

          setIsLoading(false);
          return;
        }

        // -------------------------------------------------
        // NO FIREBASE USER
        // -------------------------------------------------

        if (!firebaseUser) {
          setUser(null);

          if (typeof window !== "undefined") {
            localStorage.removeItem("twitter-user");
          }

          setIsLoading(false);
          return;
        }

        // -------------------------------------------------
        // EXISTING AUTHENTICATED SESSION
        // -------------------------------------------------

        try {
          await requestNotificationPermission();

          const res = await axiosInstance.get(
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

            localStorage.setItem(
              "twitter-user",
              JSON.stringify(backendUser)
            );
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

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (!cleanEmail || !password) {
        throw new Error(
          "Email and password are required."
        );
      }

      // -------------------------------------------------
      // IMPORTANT:
      // Set this BEFORE Firebase login.
      // onAuthStateChanged will see this and stop
      // automatic authentication.
      // -------------------------------------------------

      pendingOtpEmailRef.current = cleanEmail;

      console.log(
        "🔐 Starting Firebase password login..."
      );

      // -------------------------------------------------
      // 1. FIREBASE LOGIN
      // -------------------------------------------------

      const usercred =
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      const firebaseUser = usercred.user;

      if (!firebaseUser.email) {
        pendingOtpEmailRef.current = null;

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
      // 2. BACKEND USER CHECK
      // -------------------------------------------------

      const browserName =
        typeof navigator !== "undefined"
          ? navigator.userAgent
          : "Unknown";

      const res = await axiosInstance.get(
        "/loggedinuser",
        {
          params: {
            email: firebaseUser.email,
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
      // 3. VALIDATE BACKEND USER
      // -------------------------------------------------

      if (!backendUser?._id) {
        pendingOtpEmailRef.current = null;

        await signOut(auth);

        setUser(null);

        localStorage.removeItem(
          "twitter-user"
        );

        throw new Error(
          "User profile not found. Please register this account first."
        );
      }

      console.log(
        "✅ User profile validated:",
        backendUser.email
      );

      // -------------------------------------------------
      // 4. LOGIN HISTORY
      // -------------------------------------------------

      try {
        await axiosInstance.post(
          "/login-history",
          {
            email: firebaseUser.email,
            browser: browserName,
          }
        );

        console.log(
          "✅ Login history saved"
        );
      } catch (historyError: any) {
        console.warn(
          "⚠️ Login history failed:",
          historyError?.response?.data ||
            historyError?.message
        );
      }

      // -------------------------------------------------
      // VERY IMPORTANT
      //
      // DO NOT:
      //
      // setUser(backendUser)
      //
      // User is still waiting for OTP.
      // -------------------------------------------------

      // -------------------------------------------------
      // 5. SEND LOGIN OTP
      // -------------------------------------------------

      await axiosInstance.post(
        "/send-login-otp",
        {
          email: firebaseUser.email,
        }
      );

      console.log(
        "📧 Login OTP sent successfully"
      );

      // -------------------------------------------------
      // 6. RETURN OTP REQUIREMENT
      // -------------------------------------------------
       setOtpEmail(firebaseUser.email);
       setOtpPending(true);  
      return {
        requireOtp: true,
        email: firebaseUser.email,
      };
    } catch (error: any) {
      console.error(
        "🔥 LOGIN ERROR:",
        error?.response?.data ||
          error?.message ||
          error
      );

      // If login completely fails,
      // cancel OTP pending state.

      pendingOtpEmailRef.current = null;

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

    // First remove OTP pending state
    pendingOtpEmailRef.current = null;
    setOtpPending(false);
     setOtpEmail("");
    // Now application is actually logged in
    setUser(authenticatedUser);

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "twitter-user",
        JSON.stringify(authenticatedUser)
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
        email: firebaseUser.email,
        uid: firebaseUser.uid,
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

      localStorage.setItem(
        "twitter-user",
        JSON.stringify(backendUser)
      );
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
      pendingOtpEmailRef.current = null;

      setUser(null);

      await signOut(auth);

      localStorage.removeItem(
        "twitter-user"
      );

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
      preferredLanguage: language,
    };

    setUser(updatedUser);

    localStorage.setItem(
      "twitter-user",
      JSON.stringify(updatedUser)
    );
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

        localStorage.setItem(
          "twitter-user",
          JSON.stringify(finalUser)
        );
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
                uid: firebaseuser.uid,
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
            firebaseuser.email.split("@")[0],

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

      localStorage.setItem(
        "twitter-user",
        JSON.stringify(userData)
      );

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
        error.response?.data?.message ||
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