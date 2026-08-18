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
        <Landing />

        <LoginOtpModal
          open={true}
          email={otpEmail}
          onClose={() => {}}
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
    <div className="min-h-screen w-full bg-black text-white overflow-x-hidden">
      <div className="w-full max-w-[1400px] mx-auto flex min-h-screen">

        {/* =================================================
            LEFT SIDEBAR
        ================================================= */}

        <aside
          className="
            shrink-0
            w-16
            sm:w-20
            md:w-64
            border-r
            border-gray-800
          "
        >
          <Sidebar
            currentPage={currentPage}
            onNavigate={setCurrentPage}
          />
        </aside>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main
          className="
            flex-1
            min-w-0
            w-0
            border-r
            border-gray-800
          "
        >
          {currentPage === "profile" ? (
            <ProfilePage />
          ) : (
            children
          )}
        </main>

        {/* =================================================
            RIGHT SIDEBAR
        ================================================= */}

        <aside
          className="
            hidden
            lg:block
            shrink-0
            w-72
            xl:w-80
            p-4
          "
        >
          <RightSidebar />
        </aside>

      </div>
    </div>
  );
};

export default Mainlayout;