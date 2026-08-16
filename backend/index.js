import "dotenv/config";


import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import nodemailer from "nodemailer";
import otpStore from "./utils/otpStore.js";
import cloudinary from "./config/cloudinary.js";
import upload from "./utils/multer.js";
import audioUpload from "./utils/audioUpload.js";
import fs from "fs";
import { adminAuth } from "./config/firebaseAdmin.js";
import razorpay from "./config/razorpay.js";
import crypto from "crypto";
import { getDeviceInfo } from "./utils/deviceInfo.js";
import { isLoginAllowed } from "./utils/checkLoginTime.js";
import LoginHistory from "./models/LoginHistory.js";



console.log("Cloudinary config check:", {
  cloudName: process.env.CLOUD_NAME,
  apiKey: process.env.CLOUD_API_KEY
    ? "LOADED"
    : "MISSING",
  apiSecret: process.env.CLOUD_API_SECRET
    ? "LOADED"
    : "MISSING",
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
transporter.verify((error, success) => {
  if (error) {
    console.error("🔥 EMAIL CONFIG ERROR:", error);
  } else {
    console.log("✅ EMAIL SERVER READY");
  }
});
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });
 app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(email, otp);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Twiller Audio Tweet OTP",
      text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
    });

    setTimeout(() => {
      otpStore.delete(email);
    }, 5 * 60 * 1000);

    res.send({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (err) {
  console.error("🔥 SEND OTP ERROR:", err);

  res.status(500).send({
    success: false,
    message: "Failed to send OTP",
    error: err.message,
  });
}
}); 
app.post("/send-login-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const otp = generateOTP();

    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Login OTP",
      html: `
        <h2>Login Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 5 minutes.</p>
      `,
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("OTP error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});
app.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const storedOtp = otpStore.get(email);

    if (!storedOtp) {
      return res.status(400).json({
        message: "OTP not found or expired",
      });
    }

    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(email);

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    if (storedOtp.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    otpStore.delete(email);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
   const deviceInfo = getDeviceInfo(req.headers["user-agent"]);

    user.loginHistory.push({
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress,
      loginTime: new Date(),
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: "OTP verified",
      user,
    });
  } catch (error) {
    console.error("OTP verification error:", error);

    res.status(500).json({
      message: "OTP verification failed",
    });
  }
});
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const savedOtp = otpStore.get(email);

  if (!savedOtp) {
    return res.status(400).send({
      success: false,
      message: "OTP expired",
    });
  }

  if (savedOtp !== otp) {
    return res.status(400).send({
      success: false,
      message: "Invalid OTP",
    });
  }

  otpStore.delete(email);

  res.send({
    success: true,
    message: "OTP verified",
  });
});
app.post("/request-language-change", async (req, res) => {
  try {
    const { email, phoneNumber, language } = req.body;

    const user = await User.findOne({
      $or: [
        { email: email || "" },
        { phoneNumber: phoneNumber || "" },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate OTP
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    // 🇫🇷 French → Email OTP
    if (language === "fr") {
      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "No registered email found for this account.",
        });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Twiller Language Change OTP",
        text: `Your OTP for changing the language is ${otp}. This OTP is valid for 5 minutes.`,
      });

      console.log(`Language OTP sent to email: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: "OTP sent to your registered email.",
        method: "email",
      });
    }

    // 🌍 Other languages → Mobile OTP
    if (!user.phoneNumber) {
      return res.status(400).json({
        success: false,
        message:
          "No registered phone number found. Please add a phone number before changing the language.",
      });
    }

    // Temporary until SMS service is integrated
    console.log(
      `SMS OTP for ${user.phoneNumber}: ${otp}`
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent to your registered phone number.",
      method: "phone",
    });

  } catch (error) {
    console.error("Language change OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send language change OTP",
    });
  }
});

app.post("/verify-language-otp", async (req, res) => {
  try {
    const { email, phoneNumber, otp, language } = req.body;

    const user = await User.findOne({
      $or: [
        { email: email || "" },
        { phoneNumber: phoneNumber || "" },
      ],
    });

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // OTP exists?
    if (!user.otp) {
      return res.status(400).send({
        success: false,
        message: "No OTP found",
      });
    }

    // Expired?
    if (new Date() > user.otpExpiry) {
      return res.status(400).send({
        success: false,
        message: "OTP expired",
      });
    }

    // Wrong OTP?
    if (user.otp !== otp) {
      return res.status(400).send({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Update language
    user.preferredLanguage = language;

    // Clear OTP
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    res.send({
      success: true,
      message: "Language updated successfully.",
      language,
    });

  } catch (err) {
    console.log(err);

    res.status(500).send({
      success: false,
      message: "Verification failed",
    });
  }
});

app.post("/forgot-password", async (req, res) => {
  try {
    const { email, phone } = req.body;

    const user = await User.findOne({
      $or: [
        { email: email || "" },
        { phoneNumber: phone || "" },
      ],
    });

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // One request per day
    if (user.lastPasswordReset) {
      const last = new Date(user.lastPasswordReset);
      const today = new Date();

      const sameDay =
        last.getDate() === today.getDate() &&
        last.getMonth() === today.getMonth() &&
        last.getFullYear() === today.getFullYear();

      if (sameDay) {
        return res.status(400).send({
          success: false,
          message: "You can use this option only one time per day.",
        });
      }
    }
     
    const resetLink = await adminAuth.generatePasswordResetLink(user.email);

await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: user.email,
  subject: "Twiller Password Reset",
  html: `
    <h2>Password Reset</h2>

    <p>Click the button below to reset your password.</p>

    <a href="${resetLink}">
      <button
        style="
          background:#1d9bf0;
          color:white;
          padding:10px 20px;
          border:none;
          border-radius:6px;
          cursor:pointer;
        "
      >
        Reset Password
      </button>
    </a>

    <p>This link is generated by Firebase.</p>
  `,
});
    

    // Save today's reset date
    user.lastPasswordReset = new Date();
    await user.save();

    // Send email
    

   return res.send({
  success: true,
  message: "Password reset link has been sent to your email.",
});

  } catch (err) {
    console.log(err);

    res.status(500).send({
      success: false,
      message: "Password reset failed",
    });
  }
});
//Register
app.post("/upload-audio",
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No audio file uploaded",
        });
      }

      console.log("🎵 Audio file:", {
        name: req.file.originalname,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
        type: req.file.mimetype,
      });

      console.log("☁️ Uploading audio to Cloudinary...");

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(
          req.file.path,
          {
            resource_type: "video",
            folder: "twiller-audio",
            chunk_size: 6 * 1024 * 1024,
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
      });

      console.log("☁️ CLOUDINARY AUDIO RESULT:", result);

      const audioUrl = result?.secure_url;

      console.log("✅ AUDIO URL:", audioUrl);

      if (!audioUrl) {
        throw new Error("Cloudinary did not return audio URL");
      }

      return res.status(200).json({
        success: true,
        url: audioUrl,
      });
    } catch (error) {
      console.error("🔥 AUDIO UPLOAD ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Audio upload failed",
        error: error?.message,
      });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log("🗑️ Temporary audio file deleted");
        } catch (deleteError) {
          console.error(
            "Failed to delete temporary audio:",
            deleteError
          );
        }
      }
    }
  }
);
app.post(
  "/upload-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image uploaded",
        });
      }

      console.log("📸 IMAGE FILE:", {
        name: req.file.originalname,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
        type: req.file.mimetype,
        path: req.file.path,
      });

      console.log("☁️ Uploading image to Cloudinary...");

      const result = await cloudinary.uploader.upload(
        req.file.path,
        {
          resource_type: "image",
          folder: "twiller-images",
        }
      );

      console.log("☁️ CLOUDINARY IMAGE RESULT:", result);

      if (!result?.secure_url) {
        throw new Error(
          "Cloudinary did not return image URL"
        );
      }

      console.log(
        "✅ IMAGE URL:",
        result.secure_url
      );

      return res.status(200).json({
        success: true,
        url: result.secure_url,
      });
    } catch (error) {
      console.error("🔥 CLOUDINARY IMAGE ERROR:", {
        message: error?.message,
        name: error?.name,
        http_code: error?.http_code,
        fullError: error,
      });

      return res.status(500).json({
        success: false,
        message: "Image upload failed",
        error: error?.message,
      });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log("🗑️ Temporary image deleted");
        } catch (deleteError) {
          console.error(
            "Failed to delete temporary image:",
            deleteError
          );
        }
      }
    }
  }
);

app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });

    if (existinguser) {
      return res.status(200).send(existinguser);
    }

    const newUser = new User({
      ...req.body,

      subscriptionPlan: "FREE",
      subscriptionExpiry: null,
      tweetCount: 0,
    });

    await newUser.save();

    return res.status(201).send(newUser);

  } catch (error) {
    return res.status(400).send({
      error: error.message,
    });
  }
});
// loggedinuser
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email, uid, browser } = req.query;

    console.log("LOGIN CHECK:");
    console.log("Email:", email);
    console.log("Firebase UID:", uid);
    console.log("Browser:", browser);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID required",
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
     * Existing users created before UID was required
     * may not have a UID.
     *
     * Since Firebase has already authenticated this user,
     * attach the Firebase UID to the MongoDB profile.
     */
    if (!user.uid) {
      user.uid = String(uid);
      console.log("✅ Firebase UID added to existing user");
    } else if (user.uid !== String(uid)) {
      console.error("❌ Firebase UID mismatch");

      return res.status(403).json({
        success: false,
        message: "Firebase account does not match this user profile",
      });
    }

    const deviceInfo = getDeviceInfo(
      req.headers["user-agent"]
    );

    // Mobile login restriction
    if (!isLoginAllowed(deviceInfo.deviceType)) {
      return res.status(403).json({
        success: false,
        message:
          "Mobile login is allowed only between 10:00 AM and 1:00 PM.",
      });
    }

    user.loginHistory.push({
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress,
      loginTime: new Date(),
    });

    await user.save();

    console.log("✅ User profile validated:", user.email);

    return res.status(200).json({
      success: true,
      requireOtp: true,
      email: user.email,
      user,
      deviceInfo,
    });
  } catch (error) {
    console.error("🔥 /loggedinuser ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
app.post("/send-login-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    const otp = generateOtp();

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Login Verification OTP",
      html: `
        <h2>Twitter Clone Login Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
      `,
    });

    return res.send({
      message: "OTP sent successfully",
    });

  } catch (err) {
    console.log(err);

    return res.status(500).send({
      message: "Failed to send OTP",
    });
  }
});
app.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    if (user.otp !== otp) {
      return res.status(400).send({
        message: "Invalid OTP",
      });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).send({
        message: "OTP Expired",
      });
    }

    // Clear OTP
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    return res.send({
      success: true,
      message: "OTP Verified",
      user,
    });

  } catch (err) {
    console.log(err);

    return res.status(500).send({
      message: "OTP verification failed",
    });
  }
});

app.get("/fix-users", async (req, res) => {
  await User.updateMany(
    {
      notificationsEnabled: { $exists: false },
    },
    {
      $set: {
        notificationsEnabled: true,
      },
    }
  );

  res.send("Done");
});
app.get("/fix-subscriptions", async (req, res) => {
  await User.updateMany(
    {
      subscriptionPlan: { $exists: false },
    },
    {
      $set: {
        subscriptionPlan: "FREE",
        subscriptionExpiry: null,
        tweetCount: 0,
      },
    }
  );

  res.send("Subscriptions updated successfully.");
});
// update Profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false }
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// Tweet API
// Update notification preference
app.patch("/notification/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { notificationsEnabled } = req.body;

    const user = await User.findOneAndUpdate(
      { email },
      { notificationsEnabled },
      { new: true }
    );

    res.status(200).send(user);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});
// POST
app.post("/create-order", async (req, res) => {
  try {
    const { plan } = req.body;

    // -------- Time Restriction (IST) --------
    const now = new Date();

    const istTime = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
      })
    );

    const hour = istTime.getHours();

    // if (hour < 10 || hour >= 11) {
    //   return res.status(400).send({
    //     success: false,
    //     message:
    //       "Payments are allowed only between 10:00 AM and 11:00 AM IST.",
    //   });
    // }

    // -------- Plan Price --------

    const prices = {
      BRONZE: 100,
      SILVER: 300,
      GOLD: 1000,
    };

    const amount = prices[plan];

    if (!amount) {
      return res.status(400).send({
        success: false,
        message: "Invalid Subscription Plan",
      });
    }

    // -------- Razorpay Order --------

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.send({
      success: true,
      order,
    });

  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Failed to create order",
    });
  }
});
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      plan,
    } = req.body;

    // Verify Signature
    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).send({
        success: false,
        message: "Invalid Payment Signature",
      });
    }

    // Find User
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Subscription Expiry = 30 Days
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const prices = {
  BRONZE: 100,
  SILVER: 300,
  GOLD: 1000,
};

const invoiceId = "INV-" + Date.now();

    user.subscriptionPlan = plan;
    user.subscriptionExpiry = expiry;
    user.tweetCount = 0;

    await user.save();
    await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: user.email,
  subject: "Twiller Subscription Invoice",

  html: `
    <h2>Twiller Subscription Successful</h2>

    <hr/>

    <p><strong>Invoice ID:</strong> ${invoiceId}</p>

    <p><strong>Plan:</strong> ${plan}</p>

    <p><strong>Amount:</strong> ₹${prices[plan]}</p>

    <p><strong>Purchase Date:</strong> ${new Date().toLocaleString()}</p>

    <p><strong>Expiry Date:</strong> ${expiry.toDateString()}</p>

    <hr/>

    <h3>Thank you for purchasing Twiller Premium.</h3>
  `,
});

   res.send({
  success: true,
  message: "Subscription Activated Successfully",
});

  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Payment Verification Failed",
    });
  }
});
app.post("/login-history", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const userAgent = req.headers["user-agent"] || "";

    const deviceInfo = getDeviceInfo(userAgent);

    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "Unknown";

    const loginRecord = new LoginHistory({
      email,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      device: deviceInfo.device,
      ipAddress,
    });

    await loginRecord.save();

    res.status(201).json({
      success: true,
      message: "Login history saved",
      loginRecord,
    });
  } catch (error) {
    console.error("Login history error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save login history",
    });
  }
});
app.post("/post", async (req, res) => {
  try {
    const user = await User.findById(req.body.author);

if (!user) {
  return res.status(404).send({
    success: false,
    message: "User not found",
  });
}

// Check subscription expiry
if (
  user.subscriptionExpiry &&
  new Date() > user.subscriptionExpiry
) {
  user.subscriptionPlan = "FREE";
  user.subscriptionExpiry = null;
  user.tweetCount = 0;

  await user.save();
}

// Tweet Limits
const limits = {
  FREE: 1,
  BRONZE: 3,
  SILVER: 5,
  GOLD: Infinity,
};

const limit = limits[user.subscriptionPlan];

if (user.tweetCount >= limit) {
  return res.status(400).send({
    success: false,
    message: `Tweet limit reached for ${user.subscriptionPlan} plan. Please upgrade your subscription.`,
  });
}
    const tweet = new Tweet(req.body);
    await tweet.save();
    user.tweetCount += 1;
await user.save();

    const keywords = ["cricket", "science"];

    const shouldNotify = keywords.some((word) =>
      tweet.content.toLowerCase().includes(word)
    );

    console.log("Keyword Found:", shouldNotify);

    const populatedTweet = await Tweet.findById(tweet._id).populate("author");

    res.status(201).send(populatedTweet);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});
// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
//  LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// retweet 
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});