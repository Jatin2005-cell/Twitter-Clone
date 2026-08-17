"use client";

import { useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "@/context/AuthContext";

interface LoginOtpModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export default function LoginOtpModal({
  open,
  email,
  onClose,
  onSuccess,
}: LoginOtpModalProps) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const { setAuthenticatedUser } = useAuth();

  if (!open) {
    return null;
  }

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      alert("Please enter the 6-digit OTP");
      return;
    }

    try {
      setLoading(true);

      console.log("🔐 Verifying login OTP:", {
        email,
        otp,
      });

      const res = await axiosInstance.post(
        "/verify-login-otp",
        {
          email,
          otp,
        }
      );

      console.log(
        "✅ OTP verification response:",
        res.data
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            "OTP verification failed"
        );
      }

      const authenticatedUser =
        res.data?.user;

      if (!authenticatedUser?._id) {
        throw new Error(
          "User data missing after OTP verification"
        );
      }

      console.log(
        "🎉 OTP VERIFIED:",
        authenticatedUser
      );

      // IMPORTANT:
      // This changes AuthContext user from null
      // to authenticated backend user.
      setAuthenticatedUser(
        authenticatedUser
      );

      onSuccess(authenticatedUser);

      onClose();

    } catch (error: any) {
      console.error(
        "🔥 LOGIN OTP ERROR:",
        error?.response?.data ||
          error?.message ||
          error
      );

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "OTP verification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4">

      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-zinc-900 p-6 shadow-2xl">

        <div className="mb-6 text-center">

          <h2 className="text-2xl font-bold text-white">
            Verify Login
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Enter the 6-digit OTP sent to
          </p>

          <p className="mt-1 text-sm font-semibold text-white break-all">
            {email}
          </p>

        </div>

        <div className="space-y-4">

          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={otp}
            autoFocus
            onChange={(e) => {
              const value =
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 6);

              setOtp(value);
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                otp.length === 6 &&
                !loading
              ) {
                verifyOtp();
              }
            }}
            className="h-12 bg-black border-gray-700 text-white text-center text-lg tracking-[0.4em]"
          />

          <Button
            type="button"
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full"
            onClick={verifyOtp}
            disabled={
              loading ||
              otp.length !== 6
            }
          >
            {loading
              ? "Verifying..."
              : "Verify OTP"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 border-gray-700 text-white hover:bg-gray-800"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>

        </div>

      </div>
    </div>
  );
}