"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  MoreHorizontal,
  Camera,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import TweetCard from "./TweetCard";
import { Card, CardContent } from "./ui/card";
import Editprofile from "./Editprofile";
import axiosInstance from "@/lib/axiosInstance";

interface Tweet {
  _id: string;
  id?: string;

  author: {
    _id?: string;
    id?: string;
    username: string;
    displayName: string;
    avatar: string;
    verified?: boolean;
  };

  content: string;
  timestamp?: string;
  createdAt?: string;

  likes: number;
  retweets: number;
  comments: number;

  liked?: boolean;
  retweeted?: boolean;
  image?: string;
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("posts");
  const [showEditModal, setShowEditModal] = useState(false);

  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch tweets
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const fetchTweets = async () => {
      try {
        setLoading(true);

        const res = await axiosInstance.get("/post");

        if (isMounted) {
          setTweets(res.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch tweets:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTweets();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // User not logged in
  if (!user) {
    return null;
  }

  // Filter tweets by current user
  const userTweets = tweets.filter(
    (tweet) =>
      tweet.author?._id === user._id ||
      tweet.author?.id === user._id
  );

  return (
    <div className="min-h-screen">

      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="flex items-center px-4 py-3 space-x-8">

          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Button>

          <div>
            <h1 className="text-xl font-bold text-white">
              {user.displayName || "User"}
            </h1>

            <p className="text-sm text-gray-400">
              {userTweets.length} posts
            </p>
          </div>

        </div>
      </div>

      {/* Cover Photo */}
      <div className="relative">

        <div className="h-48 bg-gradient-to-r from-blue-600 to-purple-600 relative">

          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70"
          >
            <Camera className="h-5 w-5 text-white" />
          </Button>

        </div>

        {/* Profile Picture */}
        <div className="absolute -bottom-16 left-4">

          <div className="relative">

            <Avatar className="h-32 w-32 border-4 border-black">

              <AvatarImage
                src={user.avatar}
                alt={user.displayName || "User"}
              />

              <AvatarFallback className="text-2xl">
                {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>

            </Avatar>

            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 p-2 rounded-full bg-black/70 hover:bg-black/90"
            >
              <Camera className="h-4 w-4 text-white" />
            </Button>

          </div>

        </div>

        {/* Edit Profile */}
        <div className="flex justify-end p-4">

          <Button
            variant="outline"
            className="border-gray-600 text-white bg-gray-950 font-semibold rounded-full px-6"
            onClick={() => setShowEditModal(true)}
          >
            Edit profile
          </Button>

        </div>

      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 mt-12">

        <div className="flex items-start justify-between mb-3">

          <div>

            <h1 className="text-2xl font-bold text-white">
              {user.displayName || "User"}
            </h1>

            <p className="text-gray-400">
              @{user.username}
            </p>

          </div>

          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </Button>

        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-white mb-3 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Location / Website / Joined */}
        <div className="flex items-center space-x-4 text-gray-400 text-sm mb-3">

          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4" />

            <span>
              {user.location || "Earth"}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <LinkIcon className="h-4 w-4" />

            <span className="text-blue-400">
              {user.website || "example.com"}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />

            <span>
              Joined{" "}
              {user.joinedDate
                ? new Date(user.joinedDate).toLocaleDateString(
                    "en-us",
                    {
                      month: "long",
                      year: "numeric",
                    }
                  )
                : ""}
            </span>
          </div>

        </div>

      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >

        <TabsList className="grid w-full grid-cols-6 bg-transparent border-b border-gray-800 rounded-none h-auto">

          {/* Posts */}
          <TabsTrigger
            value="posts"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            Posts
          </TabsTrigger>

          {/* Replies */}
          <TabsTrigger
            value="replies"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            Replies
          </TabsTrigger>

          {/* Highlights */}
          <TabsTrigger
            value="highlights"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            Highlights
          </TabsTrigger>

          {/* Articles */}
          <TabsTrigger
            value="articles"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            Articles
          </TabsTrigger>

          {/* Media */}
          <TabsTrigger
            value="media"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            Media
          </TabsTrigger>

          {/* Login History */}
          <TabsTrigger
            value="login-history"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            Login History
          </TabsTrigger>

        </TabsList>

        {/* Posts */}
        <TabsContent value="posts" className="mt-0">

          <div className="divide-y divide-gray-800">

            {loading ? (
              <Card className="bg-black border-none">

                <CardContent className="py-12 text-center">

                  <div className="text-gray-400">

                    <h3 className="text-2xl font-bold mb-2">
                      Loading posts...
                    </h3>

                    <p>
                      Please wait while your posts are loading.
                    </p>

                  </div>

                </CardContent>

              </Card>
            ) : userTweets.length === 0 ? (
              <Card className="bg-black border-none">

                <CardContent className="py-12 text-center">

                  <div className="text-gray-400">

                    <h3 className="text-2xl font-bold mb-2">
                     You haven&apos;t posted yet
                    </h3>

                    <p>
                      When you post, it will show up here.
                    </p>

                  </div>

                </CardContent>

              </Card>
            ) : (
              userTweets.map((tweet) => (
                <TweetCard
                  key={tweet._id}
                  tweet={tweet}
                />
              ))
            )}

          </div>

        </TabsContent>

        {/* Replies */}
        <TabsContent value="replies" className="mt-0">

          <Card className="bg-black border-none">

            <CardContent className="py-12 text-center">

              <div className="text-gray-400">

                <h3 className="text-2xl font-bold mb-2">
                 You haven&apos;t replied yet
                </h3>

                <p>
                  When you reply to a post, it will show up here.
                </p>

              </div>

            </CardContent>

          </Card>

        </TabsContent>

        {/* Highlights */}
        <TabsContent value="highlights" className="mt-0">

          <Card className="bg-black border-none">

            <CardContent className="py-12 text-center">

              <div className="text-gray-400">

                <h3 className="text-2xl font-bold mb-2">
                  Lights, camera … attachments!
                </h3>

                <p>
                  When you post photos or videos, they will show up here.
                </p>

              </div>

            </CardContent>

          </Card>

        </TabsContent>

        {/* Articles */}
        <TabsContent value="articles" className="mt-0">

          <Card className="bg-black border-none">

            <CardContent className="py-12 text-center">

              <div className="text-gray-400">

                <h3 className="text-2xl font-bold mb-2">
                  You haven&apos;t written any articles
                </h3>

                <p>
                  When you write articles, they will show up here.
                </p>

              </div>

            </CardContent>

          </Card>

        </TabsContent>

        {/* Media */}
        <TabsContent value="media" className="mt-0">

          <Card className="bg-black border-none">

            <CardContent className="py-12 text-center">

              <div className="text-gray-400">

                <h3 className="text-2xl font-bold mb-2">
                  Lights, camera … attachments!
                </h3>

                <p>
                  When you post photos or videos, they will show up here.
                </p>

              </div>

            </CardContent>

          </Card>

        </TabsContent>

        {/* Login History */}
        <TabsContent value="login-history" className="mt-0">

          <Card className="bg-black border-none">

            <CardContent className="p-4">

              <h2 className="text-xl font-bold text-white mb-4">
                Login History
              </h2>

              {!user.loginHistory?.length ? (

                <p className="text-gray-400">
                  No login history available.
                </p>

              ) : (

                <div className="space-y-3">

                  {[...user.loginHistory]
                    .reverse()
                    .map((login, index) => (

                      <div
                        key={index}
                        className="border border-gray-800 rounded-lg p-4"
                      >

                        <div className="flex justify-between">

                          <div>

                            <p className="text-white font-semibold">
                              {login.browser}
                            </p>

                            <p className="text-gray-400 text-sm">
                              {login.operatingSystem} •{" "}
                              {login.deviceType}
                            </p>

                            <p className="text-gray-500 text-sm mt-1">
                              IP: {login.ipAddress}
                            </p>

                          </div>

                          <p className="text-gray-400 text-sm">
                            {new Date(
                              login.loginTime
                            ).toLocaleString()}
                          </p>

                        </div>

                      </div>

                    ))}

                </div>

              )}

            </CardContent>

          </Card>

        </TabsContent>

      </Tabs>

      {/* Edit Profile Modal */}
      <Editprofile
        isopen={showEditModal}
        onclose={() => setShowEditModal(false)}
      />

    </div>
  );
}