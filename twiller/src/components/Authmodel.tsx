"use client";

import React, { useState } from "react";
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
} from "lucide-react";

import LoadingSpinner from "./loading-spinner";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";

import { useAuth } from "../context/AuthContext";
import TwitterLogo from "./Twitterlogo";
import ForgotPasswordModal from "./ForgotPasswordModal";
import LoginOtpModal from "./LoginOtpModal";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup";
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  const {
    login,
    signup,
    isLoading,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">(
    initialMode
  );

  const [showPassword, setShowPassword] = useState(false);

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  // ==========================================
  // LOGIN OTP STATE
  // ==========================================
  const [showLoginOtp, setShowLoginOtp] = useState(false);

  const [loginOtpEmail, setLoginOtpEmail] = useState("");

  // ==========================================
  // FORM DATA
  // ==========================================
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    displayName: "",
  });

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});

  // ==========================================
  // FORM VALIDATION
  // ==========================================
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (
      !/\S+@\S+\.\S+/.test(formData.email)
    ) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password =
        "Password must be at least 6 characters";
    }

    if (mode === "signup") {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required";
      } else if (formData.username.length < 3) {
        newErrors.username =
          "Username must be at least 3 characters";
      } else if (
        !/^[a-zA-Z0-9_]+$/.test(formData.username)
      ) {
        newErrors.username =
          "Username can only contain letters, numbers, and underscores";
      }

      if (!formData.displayName.trim()) {
        newErrors.displayName =
          "Display name is required";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ==========================================
  // FORM SUBMIT
  // ==========================================
  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!validateForm() || isLoading) {
      return;
    }

    try {
      // ========================================
      // LOGIN
      // ========================================
      if (mode === "login") {
        const email = formData.email
          .trim()
          .toLowerCase();

        console.log("🔐 Starting login...");
        console.log("📧 Login email:", email);

        /*
         * login():
         *
         * Firebase password authentication
         *          ↓
         * Backend user validation
         *          ↓
         * Login OTP sent
         *          ↓
         * returns requireOtp: true
         */

        const loginResult = await login(
          email,
          formData.password
        );

        console.log(
          "✅ LOGIN RESULT:",
          loginResult
        );

        // ========================================
        // OTP REQUIRED
        // ========================================
        if (loginResult?.requireOtp) {
          const otpEmail =
            loginResult.email || email;

          console.log(
            "📧 OTP required for:",
            otpEmail
          );

          /*
           * IMPORTANT:
           *
           * First set email.
           * Then open modal.
           */
          setLoginOtpEmail(otpEmail);

          setShowLoginOtp(true);

          console.log(
            "🔐 Login OTP modal state = TRUE"
          );

          return;
        }

        /*
         * Safety fallback.
         */
        console.warn(
          "⚠️ Login completed without OTP requirement"
        );

        return;
      }

      // ========================================
      // SIGNUP
      // ========================================
      await signup(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.username.trim(),
        formData.displayName.trim()
      );

      console.log(
        "✅ Signup successful"
      );

      onClose();

      setFormData({
        email: "",
        password: "",
        username: "",
        displayName: "",
      });

      setErrors({});
    } catch (error: any) {
      console.error(
        "🔥 Authentication error:",
        error?.response?.data ||
          error?.message ||
          error
      );

      setErrors({
        general:
          error?.response?.data?.message ||
          error?.message ||
          "Authentication failed. Please try again.",
      });
    }
  };

  // ==========================================
  // OTP SUCCESS
  // ==========================================
  const handleLoginOtpSuccess = (
    authenticatedUser: any
  ) => {
    console.log(
      "✅ LOGIN OTP VERIFIED:",
      authenticatedUser
    );

    /*
     * LoginOtpModal should already call:
     *
     * setAuthenticatedUser(user)
     *
     * inside its verification logic.
     *
     * At this point we only close the modal.
     */

    setShowLoginOtp(false);

    setLoginOtpEmail("");

    setFormData({
      email: "",
      password: "",
      username: "",
      displayName: "",
    });

    setErrors({});

    /*
     * Close main authentication modal.
     *
     * AuthContext already contains authenticated user,
     * so dashboard should render from user state.
     */
    onClose();
  };

  // ==========================================
  // OTP CLOSE
  // ==========================================
  const handleLoginOtpClose = () => {
    console.log(
      "❌ Login OTP modal closed"
    );

    setShowLoginOtp(false);
    setLoginOtpEmail("");
  };

  // ==========================================
  // INPUT CHANGE
  // ==========================================
  const handleInputChange = (
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }

    if (errors.general) {
      setErrors((prev) => ({
        ...prev,
        general: "",
      }));
    }
  };

  // ==========================================
  // SWITCH LOGIN / SIGNUP
  // ==========================================
  const switchMode = () => {
    setMode(
      mode === "login"
        ? "signup"
        : "login"
    );

    setErrors({});

    setShowLoginOtp(false);
    setLoginOtpEmail("");

    setFormData({
      email: "",
      password: "",
      username: "",
      displayName: "",
    });
  };

  // ==========================================
  // NOTHING TO RENDER
  // ==========================================
  if (!isOpen && !showLoginOtp) {
    return null;
  }

  return (
    <>
      {/* ========================================
          MAIN AUTH MODAL
          Hide it completely while OTP is open
      ======================================== */}
      {isOpen && !showLoginOtp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-black border-gray-800 text-white">

            {/* ==================================
                HEADER
            ================================== */}
            <CardHeader className="relative pb-6">

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 text-white hover:bg-gray-900"
                onClick={onClose}
                disabled={isLoading}
              >
                <X className="h-5 w-5" />
              </Button>

              <div className="text-center">

                <div className="mb-6 flex justify-center">
                  <TwitterLogo
                    size="xl"
                    className="text-white"
                  />
                </div>

                <CardTitle className="text-2xl font-bold">
                  {mode === "login"
                    ? "Sign in to X"
                    : "Create your account"}
                </CardTitle>

              </div>
            </CardHeader>

            {/* ==================================
                CONTENT
            ================================== */}
            <CardContent className="space-y-6">

              {/* GENERAL ERROR */}
              {errors.general && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
                  {errors.general}
                </div>
              )}

              {/* ==================================
                  FORM
              ================================== */}
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                {/* ==================================
                    SIGNUP FIELDS
                ================================== */}
                {mode === "signup" && (
                  <>
                    {/* DISPLAY NAME */}
                    <div className="space-y-2">

                      <Label
                        htmlFor="displayName"
                        className="text-white"
                      >
                        Display Name
                      </Label>

                      <div className="relative">

                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />

                        <Input
                          id="displayName"
                          type="text"
                          placeholder="Your display name"
                          value={formData.displayName}
                          onChange={(e) =>
                            handleInputChange(
                              "displayName",
                              e.target.value
                            )
                          }
                          className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                          disabled={isLoading}
                        />

                      </div>

                      {errors.displayName && (
                        <p className="text-red-400 text-sm">
                          {errors.displayName}
                        </p>
                      )}

                    </div>

                    {/* USERNAME */}
                    <div className="space-y-2">

                      <Label
                        htmlFor="username"
                        className="text-white"
                      >
                        Username
                      </Label>

                      <div className="relative">

                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          @
                        </span>

                        <Input
                          id="username"
                          type="text"
                          placeholder="username"
                          value={formData.username}
                          onChange={(e) =>
                            handleInputChange(
                              "username",
                              e.target.value
                            )
                          }
                          className="pl-8 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                          disabled={isLoading}
                        />

                      </div>

                      {errors.username && (
                        <p className="text-red-400 text-sm">
                          {errors.username}
                        </p>
                      )}

                    </div>
                  </>
                )}

                {/* ==================================
                    EMAIL
                ================================== */}
                <div className="space-y-2">

                  <Label
                    htmlFor="email"
                    className="text-white"
                  >
                    Email
                  </Label>

                  <div className="relative">

                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />

                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange(
                          "email",
                          e.target.value
                        )
                      }
                      className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                      disabled={isLoading}
                    />

                  </div>

                  {errors.email && (
                    <p className="text-red-400 text-sm">
                      {errors.email}
                    </p>
                  )}

                </div>

                {/* ==================================
                    PASSWORD
                ================================== */}
                <div className="space-y-2">

                  <Label
                    htmlFor="password"
                    className="text-white"
                  >
                    Password
                  </Label>

                  <div className="relative">

                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />

                    <Input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange(
                          "password",
                          e.target.value
                        )
                      }
                      className="pl-10 pr-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                      disabled={isLoading}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>

                  </div>

                  {errors.password && (
                    <p className="text-red-400 text-sm">
                      {errors.password}
                    </p>
                  )}

                </div>

                {/* ==================================
                    SUBMIT
                ================================== */}
                <Button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">

                      <LoadingSpinner size="sm" />

                      <span>
                        {mode === "login"
                          ? "Signing in..."
                          : "Creating account..."}
                      </span>

                    </div>
                  ) : mode === "login" ? (
                    "Sign in"
                  ) : (
                    "Create account"
                  )}
                </Button>

              </form>

              {/* ==================================
                  OR
              ================================== */}
              <div className="relative">

                <Separator className="bg-gray-700" />

                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-2 text-gray-400 text-sm">
                  OR
                </span>

              </div>

              {/* ==================================
                  SWITCH LOGIN / SIGNUP
              ================================== */}
              <div className="text-center">

                <p className="text-gray-400">

                  {mode === "login"
                    ? "Don't have an account?"
                    : "Already have an account?"}

                  <Button
                    type="button"
                    variant="link"
                    className="text-blue-400 hover:text-blue-300 font-semibold pl-1"
                    onClick={switchMode}
                    disabled={isLoading}
                  >
                    {mode === "login"
                      ? "Sign up"
                      : "Sign in"}
                  </Button>

                </p>

                {/* FORGOT PASSWORD */}
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowForgotPassword(true)
                    }
                    className="text-blue-500 text-sm hover:underline mt-3"
                  >
                    Forgot Password?
                  </button>
                )}

              </div>

              {/* ==================================
                  SIGNUP TERMS
              ================================== */}
              {mode === "signup" && (
                <div className="text-center text-xs text-gray-400">
                  By signing up, you agree to our
                  Terms of Service and Privacy
                  Policy, including Cookie Use.
                </div>
              )}

            </CardContent>
          </Card>

          {/* ==================================
              FORGOT PASSWORD
          ================================== */}
          {showForgotPassword && (
            <ForgotPasswordModal
              onClose={() =>
                setShowForgotPassword(false)
              }
            />
          )}

        </div>
      )}

      {/* ========================================
          LOGIN OTP MODAL
          
          IMPORTANT:
          High z-index so it is ALWAYS above
          Landing/Auth modal.
      ======================================== */}
      {showLoginOtp && (
        <div className="fixed inset-0 z-[100]">
          <LoginOtpModal
            open={true}
            email={loginOtpEmail}
            onClose={handleLoginOtpClose}
            onSuccess={handleLoginOtpSuccess}
          />
        </div>
      )}
    </>
  );
}