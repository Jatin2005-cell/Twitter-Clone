"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import {
  Image,
  Smile,
  Calendar,
  MapPin,
  BarChart3,
  Globe,
  Mic,
} from "lucide-react";
import { Separator } from "./ui/separator";
import axios from "axios";
import axiosInstance from "@/lib/axiosInstance";
import { showNotification } from "@/lib/notification";
import OTPModal from "./OTPModal";

interface Tweet {
  _id: string;
  author:
    | string
    | {
        _id?: string;
        id?: string;
        username: string;
        displayName: string;
        avatar: string;
      };
  content: string;
  image?: string;
  audio?: string;
  likes?: number;
  retweets?: number;
  comments?: number;
  createdAt?: string;
  timestamp?: string;
}

interface TweetComposerProps {
  onTweetPosted: (tweet: Tweet) => void;
}

const TweetComposer = ({ onTweetPosted }: TweetComposerProps) => {
  const { user } = useAuth();

  console.log("Current User:", user);

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageurl, setImageurl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);

  const maxLength = 200;

  // =========================
  // SEND AUDIO OTP
  // =========================
  const sendOtp = async () => {
    if (!user?.email) {
      alert("User email not found.");
      return;
    }

    try {
      await axiosInstance.post("/send-otp", {
        email: user.email,
      });

      alert("OTP sent to your email");
      setShowOtpModal(true);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          "OTP ERROR:",
          error.response?.status,
          error.response?.data
        );

        alert(
          error.response?.data?.message ||
            error.response?.data?.error ||
            "Failed to send OTP"
        );
      } else {
        console.error("OTP ERROR:", error);
        alert("Failed to send OTP");
      }
    }
  };

  // =========================
  // POST TWEET
  // =========================
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!user._id) {
      console.error("User object does not contain _id:", user);
      alert("User ID is missing. Please login again.");
      return;
    }

    if (!content.trim()) {
      return;
    }

    if (content.length > maxLength) {
      alert(`Tweet cannot exceed ${maxLength} characters.`);
      return;
    }

    try {
      setIsLoading(true);

      const tweetData = {
        author: user._id,
        content: content.trim(),
        image: imageurl || null,
        audio: audioUrl || null,
      };

      console.log("Posting tweet:", tweetData);

      const res = await axiosInstance.post<Tweet>(
        "/post",
        tweetData
      );

      console.log("Tweet posted successfully:", res.data);

      onTweetPosted(res.data);

      // =========================
      // KEYWORD NOTIFICATION
      // =========================
      const keywords = ["cricket", "science"];

      const shouldNotify = keywords.some((word) =>
        content.toLowerCase().includes(word)
      );

      if (
        shouldNotify &&
        user.notificationsEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        showNotification("Keyword Tweet 🚀", content);
      }

      // =========================
      // RESET FORM
      // =========================
      setContent("");
      setImageurl("");
      setAudioUrl("");
      setAudioFile(null);
      setOtpVerified(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          "🔥 POST TWEET ERROR:",
          error.response?.status,
          error.response?.data
        );

        const backendMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to post tweet.";

        alert(backendMessage);
      } else {
        console.error("🔥 POST TWEET ERROR:", error);
        alert("Failed to post tweet.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;

  if (!user) return null;

  // =========================
  // IMAGE UPLOAD
  // =========================
 const handlePhotoUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  if (!e.target.files || e.target.files.length === 0) {
    return;
  }

  const image = e.target.files[0];

  // Optional basic validation
  if (!image.type.startsWith("image/")) {
    alert("Please select a valid image");
    return;
  }

  setIsLoading(true);

  const formData = new FormData();
  formData.append("image", image);

  try {
    console.log("📸 Uploading image:", {
      name: image.name,
      size: image.size,
      type: image.type,
    });

    const res = await axiosInstance.post(
  "/upload-image",
  formData
);

    console.log("✅ IMAGE UPLOADED:", res.data);

    if (res.data?.url) {
      setImageurl(res.data.url);
      alert("Image uploaded successfully ✅");
    } else {
      throw new Error("Cloudinary URL not returned");
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error("🔥 IMAGE UPLOAD ERROR:", {
        status: error.response?.status,
        data: error.response?.data,
      });

      alert(
        error.response?.data?.message ||
          "Image upload failed"
      );
    } else {
      console.error("🔥 IMAGE UPLOAD ERROR:", error);
      alert("Image upload failed");
    }
  } finally {
    setIsLoading(false);
  }
};

  // =========================
  // AUDIO UPLOAD
  // =========================
 const handleAudioUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  // File select nahi hui
  if (!file) return;

  // =========================
  // AUDIO TYPE
  // =========================

  if (!file.type.startsWith("audio/")) {
    alert("Please select a valid audio file");
    e.target.value = "";
    return;
  }

  // =========================
  // 100 MB LIMIT
  // =========================

  if (file.size > 100 * 1024 * 1024) {
    alert("Audio size cannot exceed 100 MB");
    e.target.value = "";
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const audio = new Audio(objectUrl);

  audio.onloadedmetadata = async () => {
    try {
      // =========================
      // 5 MINUTE LIMIT
      // =========================

      if (!Number.isFinite(audio.duration)) {
        alert("Unable to determine audio duration");
        return;
      }

      if (audio.duration > 300) {
        alert("Audio duration cannot exceed 5 minutes");
        return;
      }

      // =========================
      // 2 PM - 7 PM IST
      // =========================

      const now = new Date();

      const indiaTime = new Date(
        now.toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );

      const currentMinutes =
        indiaTime.getHours() * 60 +
        indiaTime.getMinutes();

      const startTime = 14 * 60;
      const endTime = 19 * 60;

      if (
        currentMinutes < startTime ||
        currentMinutes >= endTime
      ) {
        alert(
          "Audio tweets are allowed only between 2:00 PM and 7:00 PM IST."
        );
        return;
      }

      // =========================
      // USER EMAIL
      // =========================

      if (!user?.email) {
        alert("User email not found. Please login again.");
        return;
      }

      // =========================
      // UPLOAD
      // =========================

      setIsLoading(true);

      const formData = new FormData();

      formData.append("audio", file);
      formData.append("email", user.email);

      console.log("🎵 Uploading audio:", {
        name: file.name,
        size: `${(
          file.size /
          1024 /
          1024
        ).toFixed(2)} MB`,
        type: file.type,
        duration: `${audio.duration.toFixed(2)} sec`,
      });

      const res = await axiosInstance.post(
        "/upload-audio",
        formData
      );

      console.log(
        "✅ AUDIO SERVER RESPONSE:",
        res.data
      );

      if (!res.data?.success || !res.data?.url) {
        throw new Error(
          res.data?.message ||
            "Audio URL not returned by server"
        );
      }

      // =========================
      // SAVE AUDIO
      // =========================

      setAudioFile(file);
      setAudioUrl(res.data.url);

      console.log(
        "🎵 FINAL AUDIO URL:",
        res.data.url
      );

      alert("Audio uploaded successfully ✅");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          "🔥 AUDIO UPLOAD ERROR:",
          error.response?.status,
          error.response?.data
        );

        alert(
          error.response?.data?.message ||
            error.response?.data?.error ||
            "Audio upload failed"
        );
      } else {
        console.error(
          "🔥 AUDIO UPLOAD ERROR:",
          error
        );

        alert("Audio upload failed");
      }

      // Clear failed audio
      setAudioFile(null);
      setAudioUrl("");
    } finally {
      setIsLoading(false);
      URL.revokeObjectURL(objectUrl);

      // Allow selecting same file again
      e.target.value = "";
    }
  };

  audio.onerror = () => {
    alert("Unable to read this audio file");

    URL.revokeObjectURL(objectUrl);

    setIsLoading(false);

    e.target.value = "";
  };
};

  return (
    <>
      <Card className="bg-black border-gray-800 border-x-0 border-t-0 rounded-none">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={user.avatar}
                alt={user.displayName}
              />

              <AvatarFallback>
                {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <form onSubmit={handleSubmit}>
                <Textarea
                  placeholder="What's happening?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-transparent border-none text-xl text-white placeholder-gray-500 resize-none min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0"
                />

                {audioUrl && (
                  <div className="mt-3">
                    <audio controls className="w-full">
                      <source src={audioUrl} />
                    </audio>
                  </div>
                )}

                {imageurl && (
                  <div className="mt-3">
                    <img
                      src={imageurl}
                      alt="Tweet image"
                      className="max-h-60 rounded-xl object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-4 text-blue-400">
                    {/* IMAGE */}
                    <label
                      htmlFor="tweetImage"
                      className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                    >
                      <Image className="h-5 w-5" />

                      <input
                        type="file"
                        accept="image/*"
                        id="tweetImage"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={isLoading}
                      />
                    </label>

                    {/* POLL */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 rounded-full hover:bg-blue-900/20"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </Button>

                    {/* EMOJI */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 rounded-full hover:bg-blue-900/20"
                    >
                      <Smile className="h-5 w-5" />
                    </Button>

                    {/* CALENDAR */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 rounded-full hover:bg-blue-900/20"
                    >
                      <Calendar className="h-5 w-5" />
                    </Button>

                    {/* LOCATION */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 rounded-full hover:bg-blue-900/20"
                    >
                      <MapPin className="h-5 w-5" />
                    </Button>

                    {/* AUDIO */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 rounded-full hover:bg-blue-900/20"
                     onClick={() => {
  if (isLoading) return;

  if (!otpVerified) {
    sendOtp();
  } else {
    audioInputRef.current?.click();
  }
}}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>

                    <input
                      type="file"
                      accept="audio/*"
                      ref={audioInputRef}
                      className="hidden"
                      onChange={handleAudioUpload}
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-blue-400" />

                      <span className="text-sm text-blue-400 font-semibold">
                        Everyone can reply
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      {characterCount > 0 && (
                        <div className="flex items-center space-x-2">
                          <div className="relative w-8 h-8">
                            <svg className="w-8 h-8 transform -rotate-90">
                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                className="text-gray-700"
                              />

                              <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 14}`}
                                strokeDashoffset={`${
                                  2 *
                                  Math.PI *
                                  14 *
                                  (1 - characterCount / maxLength)
                                }`}
                                className={
                                  isOverLimit
                                    ? "text-red-500"
                                    : isNearLimit
                                    ? "text-yellow-500"
                                    : "text-blue-500"
                                }
                              />
                            </svg>
                          </div>

                          {isNearLimit && (
                            <span
                              className={`text-sm ${
                                isOverLimit
                                  ? "text-red-500"
                                  : "text-yellow-500"
                              }`}
                            >
                              {maxLength - characterCount}
                            </span>
                          )}
                        </div>
                      )}

                      <Separator
                        orientation="vertical"
                        className="h-6 bg-gray-700"
                      />

                      <Button
                        type="submit"
                        disabled={
                          !content.trim() ||
                          isOverLimit ||
                          isLoading
                        }
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-full px-6"
                      >
                        {isLoading ? "Posting..." : "Post"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {showOtpModal && (
        <OTPModal
          open={showOtpModal}
          onClose={() => setShowOtpModal(false)}
          email={user.email}
          onVerified={() => {
            setOtpVerified(true);
            setShowOtpModal(false);
            audioInputRef.current?.click();
          }}
        />
      )}
    </>
  );
};

export default TweetComposer;