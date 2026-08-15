"use client";

import { useState } from "react";
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
    if (!open) return null;
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

 const verifyOtp = async () => {
  try {
    setLoading(true);

    await axiosInstance.post("/verify-otp", {
      email,
      otp,
    });

    alert("OTP Verified");
    onVerified();
    onClose();

  } catch (err) {
    alert("Invalid OTP");
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-xl w-[380px]">
        <h2 className="text-xl font-bold text-white mb-4">
          Verify OTP
        </h2>

        <Input
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <div className="flex gap-3 mt-5">
          <Button
            className="flex-1"
            onClick={verifyOtp}
            disabled={loading}
          >
            Verify
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}