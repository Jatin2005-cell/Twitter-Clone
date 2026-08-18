"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import LoadingSpinner from "./loading-spinner";
import TweetCard from "./TweetCard";
import TweetComposer from "./TweetComposer";
import axiosInstance from "@/lib/axiosInstance";

export interface Tweet {
  _id: string;
  // author ko string | object dono allow kar diya hai taaki type clash na ho
  author:
    | string
    | {
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
  audio?: string;
}

const Feed = () => {
  console.log("Feed Rendered");

  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTweets = useCallback(async () => {
    console.log("Inside fetchTweets");

    try {
      setLoading(true);

      const res = await axiosInstance.get<Tweet[]>("/post");

      console.log("Status:", res.status);
      console.log("Response:", res.data);

      setTweets(res.data);
    } catch (error: unknown) {
      console.error("Failed to fetch tweets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("Fetching tweets...");
    fetchTweets();
  }, [fetchTweets]);

  // newTweet parameters ko flexible rakha gaya hai
  const handleNewTweet = (newTweet: any) => {
    setTweets((prevTweets) => [newTweet, ...prevTweets]);
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Home</h1>
        </div>

        <Tabs defaultValue="foryou" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-gray-800 rounded-none h-auto">
            <TabsTrigger
              value="foryou"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-1 data-[state=active]:border-blue-100 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
            >
              For you
            </TabsTrigger>

            <TabsTrigger
              value="following"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-1 data-[state=active]:border-blue-100 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
            >
              Following
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <TweetComposer onTweetPosted={handleNewTweet} />

      <div className="divide-y divide-gray-800">
        {loading ? (
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400 mb-4">
                <LoadingSpinner size="lg" className="mx-auto mb-4" />
                <p>Loading tweets...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          tweets.map((tweet) => (
            // agar author object ke roop me nahi hai toh safer TweetCard pass-through
            <TweetCard key={tweet._id} tweet={tweet as any} />
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;