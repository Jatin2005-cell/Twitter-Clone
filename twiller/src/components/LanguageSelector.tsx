"use client";

import { useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import LanguageOtpModal from "./LanguageOtpModal";

type Language = "en" | "hi" | "es" | "pt" | "fr" | "zh";

const languages: { code: Language; name: string }[] = [
  { code: "en", name: "🇺🇸 English" },
  { code: "hi", name: "🇮🇳 Hindi" },
  { code: "es", name: "🇪🇸 Spanish" },
  { code: "pt", name: "🇵🇹 Portuguese" },
  { code: "fr", name: "🇫🇷 French" },
  { code: "zh", name: "🇨🇳 Chinese" },
];

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const { user, updatePreferredLanguage } = useAuth();

  const [selectedLanguage, setSelectedLanguage] =
    useState<Language>(language);

  const [openOtpModal, setOpenOtpModal] = useState(false);

  const requestLanguageChange = async (lang: Language) => {
    try {
      await axiosInstance.post("/request-language-change", {
        email: user?.email,
        phoneNumber: user?.phoneNumber,
        language: lang,
      });

      alert(
        lang === "fr"
          ? "OTP sent to your registered email."
          : "OTP sent to your registered phone."
      );

      setSelectedLanguage(lang);
      setOpenOtpModal(true);
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          "Failed to send OTP."
      );
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-white">🌍</span>

        <select
          value={language}
          onChange={(e) =>
            requestLanguageChange(
              e.target.value as Language
            )
          }
          className="bg-black border border-gray-700 text-white rounded-md px-2 py-1"
        >
          {languages.map((lang) => (
            <option
              key={lang.code}
              value={lang.code}
            >
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <LanguageOtpModal
        open={openOtpModal}
        email={user?.email || ""}
        phoneNumber={user?.phoneNumber || ""}
        language={selectedLanguage}
        onClose={() => setOpenOtpModal(false)}
        onSuccess={() => {
  setLanguage(selectedLanguage);
  updatePreferredLanguage(selectedLanguage);
}}
      />
    </>
  );
}