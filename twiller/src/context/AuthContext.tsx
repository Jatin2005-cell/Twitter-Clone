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
  useState,
  useEffect,
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

  if (context === undefined) {
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

  /*
   * EXISTING SESSION CHECK
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser?.email) {
          try {
            await requestNotificationPermission();

            const res = await axiosInstance.get(
              "/loggedinuser",
              {
                params: {
                  email: firebaseUser.email,
                },
              }
            );

            console.log(
              "Existing session response:",
              res.data
            );

            /*
             * Backend may return:
             *
             * { user: {...} }
             *
             * OR
             *
             * {...user}
             */
            const backendUser =
              res.data?.user || res.data;

            if (backendUser?._id) {
              setUser(backendUser);

              localStorage.setItem(
                "twitter-user",
                JSON.stringify(backendUser)
              );
            }
          } catch (err) {
            console.log(
              "Failed to fetch user:",
              err
            );
          }
        } else {
          setUser(null);

          localStorage.removeItem(
            "twitter-user"
          );
        }

        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * LOGIN
   *
   * OTP COMPLETELY DISABLED
   *
   * Flow:
   *
   * Firebase Login
   *       ↓
   * Backend User Check
   *       ↓
   * Login History
   *       ↓
   * Direct Login
   */
 const login = async (
  email: string,
  password: string
): Promise<{
  requireOtp: boolean;
  email?: string;
}> => {
  setIsLoading(true);

  try {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error("Email and password are required.");
    }

    /*
     * 1. FIREBASE LOGIN
     */
    const usercred = await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

    const firebaseUser = usercred.user;

    if (!firebaseUser.email) {
      await signOut(auth);
      throw new Error("Email not found in Firebase account.");
    }

    console.log(
      "✅ Firebase login successful:",
      firebaseUser.email
    );

    /*
     * 2. GET USER FROM BACKEND
     */
    const browserName =
      typeof navigator !== "undefined"
        ? navigator.userAgent
        : "Unknown";

    let res;

    try {
      res = await axiosInstance.get("/loggedinuser", {
        params: {
          email: firebaseUser.email,
          browser: browserName,
        },
      });
    } catch (backendError: any) {
      console.error(
        "🔥 Backend user lookup failed:",
        backendError?.response?.data || backendError
      );

      /*
       * Firebase login succeeded but MongoDB user
       * does not exist / backend failed.
       *
       * Sign Firebase user out so we don't leave
       * an inconsistent authenticated state.
       */
      await signOut(auth);

      localStorage.removeItem("twitter-user");
      setUser(null);

      throw new Error(
        backendError?.response?.data?.message ||
          "Account found in Firebase, but user profile was not found in the database."
      );
    }

    console.log(
      "✅ Backend login response:",
      res.data
    );

    /*
     * 3. SUPPORT BOTH RESPONSE FORMATS
     *
     * { user: {...} }
     *
     * OR
     *
     * {...user}
     */
    const backendUser =
      res.data?.user || res.data;

    if (!backendUser?._id) {
      console.error(
        "❌ Invalid backend user:",
        res.data
      );

      await signOut(auth);

      localStorage.removeItem("twitter-user");
      setUser(null);

      throw new Error(
        "User profile not found. Please register this account first."
      );
    }

    /*
     * 4. OPTIONAL LOGIN HISTORY
     *
     * Login should NOT fail if history logging fails.
     */
    try {
      await axiosInstance.post(
        "/login-history",
        {
          email: firebaseUser.email,
          browser: browserName,
        }
      );

      console.log("✅ Login history saved");
    } catch (historyError: any) {
      console.warn(
        "⚠️ Login history failed:",
        historyError?.response?.data ||
          historyError?.message ||
          historyError
      );
    }

    /*
     * 5. SAVE USER
     */
    setUser(backendUser);

    localStorage.setItem(
      "twitter-user",
      JSON.stringify(backendUser)
    );

    console.log(
      "🎉 LOGIN SUCCESS:",
      backendUser.email
    );

    await axiosInstance.post("/send-login-otp", {
  email: firebaseUser.email,
});

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

    throw error;
  } finally {
    setIsLoading(false);
  }
};

  /*
   * SIGNUP
   */
  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    setIsLoading(true);

    try {
      /*
       * FIREBASE SIGNUP
       */
      const usercred =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const firebaseUser =
        usercred.user;

      /*
       * BACKEND USER
       */
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

      /*
       * REGISTER USER
       */
      const res =
        await axiosInstance.post(
          "/register",
          newuser
        );

      console.log(
        "Signup response:",
        res.data
      );

      /*
       * Backend may return:
       *
       * { user: {...} }
       *
       * OR
       *
       * {...user}
       */
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
        JSON.stringify(
          backendUser
        )
      );
    } catch (error: any) {
      console.error(
        "Signup error:",
        error
      );

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /*
   * LOGOUT
   */
  const logout = async () => {
    try {
      setUser(null);

      await signOut(auth);

      localStorage.removeItem(
        "twitter-user"
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  };

  /*
   * UPDATE LANGUAGE
   */
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

    localStorage.setItem(
      "twitter-user",
      JSON.stringify(
        updatedUser
      )
    );
  };

  /*
   * SET AUTHENTICATED USER
   */
  const setAuthenticatedUser = (
    authenticatedUser: User
  ) => {
    setUser(authenticatedUser);

    localStorage.setItem(
      "twitter-user",
      JSON.stringify(
        authenticatedUser
      )
    );
  };

  /*
   * UPDATE PROFILE
   */
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
          JSON.stringify(
            finalUser
          )
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

  /*
   * GOOGLE SIGN IN
   */
  const googlesignin =
    async () => {
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

        let userData: any =
          null;

        /*
         * CHECK EXISTING USER
         */
        try {
          const res =
            await axiosInstance.get(
              "/loggedinuser",
              {
                params: {
                  email:
                    firebaseuser.email,
                },
              }
            );

          userData =
            res.data?.user ||
            res.data;
        } catch (err) {
          console.log(
            "Google user not found. Creating user..."
          );
        }

        /*
         * CREATE NEW GOOGLE USER
         */
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

        /*
         * FINAL USER CHECK
         */
        if (!userData?._id) {
          throw new Error(
            "Login/Register failed: No user data returned"
          );
        }

        setUser(userData);

        localStorage.setItem(
          "twitter-user",
          JSON.stringify(
            userData
          )
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};