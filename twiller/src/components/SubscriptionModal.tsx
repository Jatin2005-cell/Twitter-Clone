"use client";

import React from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const plans = [
  {
    name: "BRONZE",
    price: 100,
    tweets: "3 Tweets",
  },
  {
    name: "SILVER",
    price: 300,
    tweets: "5 Tweets",
  },
  {
    name: "GOLD",
    price: 1000,
    tweets: "Unlimited Tweets",
  },
];

export default function SubscriptionModal({
  isOpen,
  onClose,
}: Props) {
  if (!isOpen) return null;

  const handleBuy = async (plan: string) => {
  try {
    // Create Order
    const res = await axiosInstance.post("/create-order", {
      plan,
    });

    const order = res.data.order;
   console.log("Razorpay Key:", process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
    const options = {
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,

      amount: order.amount,

      currency: order.currency,

      name: "Twiller",

      description: `${plan} Subscription`,

      order_id: order.id,

     handler: async function (response: any) {
  try {
    const verify = await axiosInstance.post("/verify-payment", {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,

      email: JSON.parse(
        localStorage.getItem("twitter-user") || "{}"
      ).email,

      plan,
    });

    alert(verify.data.message);

    onClose();

    window.location.reload();

  } catch (err: any) {
    alert(
      err.response?.data?.message ||
      "Payment verification failed."
    );
  }
},

      theme: {
        color: "#1D9BF0",
      },
    };

    const razor = new (window as any).Razorpay(options);

    razor.open();

  } catch (err: any) {
    alert(
      err.response?.data?.message ||
      "Payment Failed"
    );
  }
};

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl p-8 w-[800px]">

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl text-white font-bold">
            Upgrade Plan
          </h2>

          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {plans.map((plan) => (

            <div
              key={plan.name}
              className="border border-zinc-700 rounded-xl p-6"
            >

              <h3 className="text-white text-2xl font-bold">
                {plan.name}
              </h3>

              <p className="text-4xl font-bold text-blue-500 mt-4">
                ₹{plan.price}
              </p>

              <p className="text-gray-400 mt-3">
                {plan.tweets}
              </p>

              <Button
                className="w-full mt-6"
                onClick={() => handleBuy(plan.name)}
              >
                Buy Now
              </Button>

            </div>

          ))}

        </div>

      </div>
    </div>
  );
}