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

  if (!open) return null;

  const verifyOtp = async () => {
    if (!otp.trim()) {
      alert("Please enter OTP");
      return;
    }

    try {
      setLoading(true);

      const res = await axiosInstance.post("/verify-login-otp", {
        email,
        otp,
      });

      if (!res.data.success) {
        throw new Error(res.data.message || "OTP verification failed");
      }

      setAuthenticatedUser(res.data.user);

      onSuccess(res.data.user);
      onClose();
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          error.message ||
          "OTP verification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="mb-2 text-2xl font-bold text-white">
          Verify Login
        </h2>

        <p className="mb-2 text-sm text-gray-400">
          Enter the OTP sent to:
        </p>

        <p className="mb-6 text-sm text-white">
          {email}
        </p>

        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            setOtp(value);
          }}
          className="bg-black border-gray-700 text-white"
        />

        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1 bg-blue-500 hover:bg-blue-600"
            onClick={verifyOtp}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>

          <Button
            variant="outline"
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