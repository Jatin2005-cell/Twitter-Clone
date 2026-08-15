"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Props {
  open: boolean;
  email: string;
  phoneNumber: string;
  language: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LanguageOtpModal({
  open,
  email,
  phoneNumber,
  language,
  onClose,
  onSuccess,
}: Props) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!open) return;

    setCountdown(30);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const verifyOtp = async () => {
    try {
      setLoading(true);

      const res = await axiosInstance.post(
        "/verify-language-otp",
        {
          email,
          phoneNumber,
          otp,
          language,
        }
      );

      alert(res.data.message);

      setOtp("");

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          "OTP verification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      setResending(true);

      await axiosInstance.post(
        "/request-language-change",
        {
          email,
          phoneNumber,
          language,
        }
      );

      alert("OTP sent again.");

      setOtp("");
      setCountdown(30);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }

          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          "Failed to resend OTP."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
      <div className="bg-zinc-900 rounded-xl p-6 w-[400px]">

        <h2 className="text-white text-2xl font-bold mb-5">
          Verify OTP
        </h2>

        <Input
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <div className="mt-4 text-center">

          {countdown > 0 ? (
            <p className="text-sm text-gray-400">
              Resend OTP in {countdown}s
            </p>
          ) : (
            <Button
              variant="link"
              disabled={resending}
              onClick={resendOtp}
            >
              {resending
                ? "Sending..."
                : "Resend OTP"}
            </Button>
          )}

        </div>

        <div className="flex gap-3 mt-6">

          <Button
            className="flex-1"
            onClick={verifyOtp}
            disabled={loading}
          >
            {loading
              ? "Verifying..."
              : "Verify"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setOtp("");
              onClose();
            }}
          >
            Cancel
          </Button>

        </div>

      </div>
    </div>
  );
}