"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

import en from "@/translations/en.json";
import hi from "@/translations/hi.json";
import es from "@/translations/es.json";
import pt from "@/translations/pt.json";
import fr from "@/translations/fr.json";
import zh from "@/translations/zh.json";

export type Language =
  | "en"
  | "hi"
  | "es"
  | "pt"
  | "fr"
  | "zh";

const translations = {
  en,
  hi,
  es,
  pt,
  fr,
  zh,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<
  LanguageContextType | undefined
>(undefined);

export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();

  const [language, setLanguageState] =
    useState<Language>("en");

  useEffect(() => {
    if (user?.preferredLanguage) {
      setLanguageState(user.preferredLanguage);
      localStorage.setItem(
        "language",
        user.preferredLanguage
      );
      return;
    }

    const saved = localStorage.getItem(
      "language"
    ) as Language;

    if (saved) {
      setLanguageState(saved);
    }
  }, [user]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string) => {
    const current =
      translations[language] as Record<
        string,
        string
      >;

    return current[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
};