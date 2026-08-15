"use client";

import { useEffect } from "react";
import Feed from "@/components/Feed";
import Mainlayout from "@/components/layout/Mainlayout";

export default function Home() {
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  return (
    <Mainlayout>
      <Feed />
    </Mainlayout>
  );
}