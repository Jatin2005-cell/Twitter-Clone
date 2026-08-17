"use client";

import { useState } from "react";
import axios from "axios";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Props {
  open: boolean;
  email: string;
  onVerified: () => void;
  onClose: () => void;
}

export default function OTPModal({
  open,
  email,
  onVerified,
  onClose,
}: Props) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const verifyOtp = async () => {
    if (!otp.trim()) {
      alert("Please enter the OTP");
      return;
    }

    if (otp.length !== 6) {
      alert("OTP must be 6 digits");
      return;
    }

    try {
      setLoading(true);

      const res = await axiosInstance.post(
        "/verify-otp",
        {
          email,
          otp: otp.trim(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || "OTP verification failed"
        );
      }

      alert("OTP Verified successfully ✅");

      setOtp("");

      onVerified();
      onClose();
    } catch (error: unknown) {
      console.error("🔥 OTP VERIFICATION ERROR:", error);

      if (axios.isAxiosError(error)) {
        alert(
          error.response?.data?.message ||
            error.response?.data?.error ||
            "Invalid or expired OTP"
        );
      } else {
        alert("Invalid or expired OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-xl w-[380px] border border-zinc-700">
        <h2 className="text-xl font-bold text-white mb-2">
          Verify Your Email
        </h2>

        <p className="text-sm text-gray-400 mb-5">
          Enter the 6-digit OTP sent to:
        </p>

        <p className="text-sm text-blue-400 mb-4">
          {email}
        </p>

        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) => {
            const value = e.target.value
              .replace(/\D/g, "")
              .slice(0, 6);

            setOtp(value);
          }}
          disabled={loading}
          className="text-white"
        />

        <div className="flex gap-3 mt-5">
          <Button
            className="flex-1"
            onClick={verifyOtp}
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setOtp("");
              onClose();
            }}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}