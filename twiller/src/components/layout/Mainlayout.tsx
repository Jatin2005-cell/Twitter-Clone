"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import LoadingSpinner from "../loading-spinner";
import Sidebar from "./Sidebar";
import RightSidebar from "./Rightsidebar";
import Landing from "../Landing";
import ProfilePage from "../ProfilePage";
import LoginOtpModal from "../LoginOtpModal";

const Mainlayout = ({ children }: { children: React.ReactNode }) => {
  const {
    user,
    isLoading,
    otpPending,
    otpEmail,
    setAuthenticatedUser,
  } = useAuth();

  const [currentPage, setCurrentPage] = useState("home");

  // =====================================================
  // LOADING
  // =====================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-4xl font-bold mb-4">
            X
          </div>

          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // =====================================================
  // OTP VERIFICATION PENDING
  // =====================================================

  if (otpPending) {
    return (
      <>
        {/* Keep landing page in background */}
        <Landing />

        {/* OTP popup stays visible */}
        <LoginOtpModal
          open={true}
          email={otpEmail}
          onClose={() => {
            // Intentionally empty.
            // User must verify OTP to complete login.
          }}
          onSuccess={(authenticatedUser) => {
            console.log(
              "✅ OTP VERIFIED FROM MAINLAYOUT:",
              authenticatedUser
            );

            setAuthenticatedUser(authenticatedUser);
          }}
        />
      </>
    );
  }

  // =====================================================
  // NOT LOGGED IN
  // =====================================================

  if (!user) {
    return <Landing />;
  }

  // =====================================================
  // AUTHENTICATED USER
  // =====================================================

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">

      {/* =================================================
          LEFT SIDEBAR
      ================================================= */}

      <div className="w-20 sm:w-24 md:w-64 border-r border-gray-800">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
      </div>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <main className="flex-1 max-w-2xl border-r border-gray-800">
        {currentPage === "profile" ? (
          <ProfilePage />
        ) : (
          children
        )}
      </main>

      {/* =================================================
          RIGHT SIDEBAR
      ================================================= */}

      <div className="hidden lg:block w-80 p-4">
        <RightSidebar />
      </div>
    </div>
  );
};

export default Mainlayout;