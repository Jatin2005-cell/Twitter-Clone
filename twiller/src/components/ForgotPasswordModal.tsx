"use client";

import { useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Props {
  onClose: () => void;
}

export default function ForgotPasswordModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim() && !phone.trim()) {
      alert("Please enter your registered email or phone number.");
      return;
    }

    try {
      setLoading(true);

      const res = await axiosInstance.post("/forgot-password", {
        email: email.trim(),
        phone: phone.trim(),
      });

      alert(res.data.message);

      setEmail("");
      setPhone("");

      onClose();
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl p-6 w-[400px] shadow-xl">

        <h2 className="text-2xl font-bold text-white mb-6">
          Forgot Password
        </h2>

        <div className="space-y-4">

          <Input
            type="email"
            placeholder="Registered Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="text-center text-gray-400 font-medium">
            OR
          </div>

          <Input
            type="tel"
            placeholder="Registered Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Button
            className="w-full"
            disabled={loading}
            onClick={handleForgotPassword}
          >
            {loading ? "Sending..." : "Reset Password"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>

        </div>
      </div>
    </div>
  );
}