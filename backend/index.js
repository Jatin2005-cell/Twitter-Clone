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

import { parseFile } from "music-metadata";
import audioOtpStore from "./utils/audioOtpStore.js";

/* =========================================================
   APP CONFIG
========================================================= */

const app = express();

app.use(cors());
app.use(express.json());

/* =========================================================
   CLOUDINARY CHECK
========================================================= */

console.log("Cloudinary config check:", {
  cloudName: process.env.CLOUD_NAME,
  apiKey: process.env.CLOUD_API_KEY
    ? "LOADED"
    : "MISSING",
  apiSecret: process.env.CLOUD_API_SECRET
    ? "LOADED"
    : "MISSING",
});

/* =========================================================
   BASIC ROUTE
========================================================= */

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

/* =========================================================
   SERVER CONFIG
========================================================= */

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;

/* =========================================================
   EMAIL CONFIG
========================================================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("🔥 EMAIL CONFIG ERROR:", error);
  } else {
    console.log("✅ EMAIL SERVER READY");
  }
});

/* =========================================================
   OTP GENERATOR
========================================================= */

const generateOTP = () => {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
};

/* =========================================================
   OTP HELPER
========================================================= */

const getStoredOTP = (email) => {
  const data = otpStore.get(email);

  if (!data) {
    return null;
  }

  if (typeof data === "string") {
    return {
      otp: data,
      expiresAt: null,
    };
  }

  return data;
};

/* =========================================================
   AUDIO TIME RESTRICTION
   2:00 PM - 7:00 PM IST
========================================================= */

const isAudioUploadTimeAllowed = () => {
  const now = new Date();

  const istTime = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    })
  );

  const hour = istTime.getHours();
  const minute = istTime.getMinutes();

  const currentMinutes =
    hour * 60 + minute;

  const startMinutes = 14 * 60;
  const endMinutes = 19 * 60;

  return (
    currentMinutes >= startMinutes &&
    currentMinutes < endMinutes
  );
};

/* =========================================================
   MONGODB CONNECTION
========================================================= */

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");

    app.listen(port, () => {
      console.log(
        `🚀 Server running on port ${port}`
      );
    });
  })
  .catch((err) => {
    console.error(
      "❌ MongoDB connection error:",
      err.message
    );
  });

/* =========================================================
   AUDIO OTP
   SEND OTP
========================================================= */

app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const emailKey = String(email).toLowerCase();

    const user = await User.findOne({
      email: emailKey,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message:
          "No registered email found for this account",
      });
    }

    const otp = generateOTP();

    audioOtpStore.set(emailKey, {
      otp,
      expiresAt:
        Date.now() + 5 * 60 * 1000,
      verified: false,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: emailKey,
      subject: "Twiller Audio Tweet OTP",

      html: `
        <h2>Twiller Audio Tweet Verification</h2>

        <p>Your OTP for uploading an audio tweet is:</p>

        <h1>${otp}</h1>

        <p>
          This OTP is valid for 5 minutes.
        </p>
      `,
    });

    return res.status(200).json({
      success: true,
      message:
        "Audio upload OTP sent successfully",
    });
  } catch (error) {
    console.error(
      "🔥 AUDIO OTP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send audio OTP",
    });
  }
});

/* =========================================================
   VERIFY AUDIO OTP
========================================================= */

app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message:
          "Email and OTP are required",
      });
    }

    const emailKey = String(email).toLowerCase();

    const storedOtp =
      audioOtpStore.get(emailKey);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message:
          "OTP not found or expired",
      });
    }

    if (
      Date.now() > storedOtp.expiresAt
    ) {
      audioOtpStore.delete(emailKey);

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (
      String(storedOtp.otp) !==
      String(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    storedOtp.verified = true;
    storedOtp.verifiedAt = Date.now();

    audioOtpStore.set(
      emailKey,
      storedOtp
    );

    return res.status(200).json({
      success: true,
      message:
        "OTP verified successfully",
    });
  } catch (error) {
    console.error(
      "🔥 AUDIO OTP VERIFY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "OTP verification failed",
    });
  }
});

/* =========================================================
   LOGIN OTP
========================================================= */

app.post("/send-login-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const emailKey = String(email).toLowerCase();

    const user = await User.findOne({
      email: emailKey,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otp = generateOTP();

    otpStore.set(emailKey, {
      otp,
      expiresAt:
        Date.now() + 5 * 60 * 1000,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: emailKey,
      subject: "Twiller Login OTP",

      html: `
        <h2>Twiller Login Verification</h2>

        <p>Your OTP is:</p>

        <h1>${otp}</h1>

        <p>
          This OTP is valid for 5 minutes.
        </p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error(
      "🔥 LOGIN OTP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send login OTP",
    });
  }
});

/* =========================================================
   VERIFY LOGIN OTP
========================================================= */

app.post("/verify-login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const emailKey = String(email).toLowerCase();

    const stored =
      getStoredOTP(emailKey);

    if (!stored) {
      return res.status(400).json({
        message:
          "OTP not found or expired",
      });
    }

    if (
      stored.expiresAt &&
      Date.now() > stored.expiresAt
    ) {
      otpStore.delete(emailKey);

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    if (
      String(stored.otp) !==
      String(otp)
    ) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    otpStore.delete(emailKey);

    const user = await User.findOne({
      email: emailKey,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const deviceInfo = getDeviceInfo(
      req.headers["user-agent"]
    );

    user.loginHistory.push({
      browser: deviceInfo.browser,
      operatingSystem:
        deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,

      ipAddress:
        req.headers["x-forwarded-for"]
          ?.split(",")[0] ||
        req.socket.remoteAddress,

      loginTime: new Date(),
    });

    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified",
      user,
    });
  } catch (error) {
    console.error(
      "🔥 LOGIN OTP VERIFICATION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "OTP verification failed",
    });
  }
});

/* =========================================================
   LANGUAGE CHANGE OTP
========================================================= */

app.post(
  "/request-language-change",
  async (req, res) => {
    try {
      const {
        email,
        phoneNumber,
        language,
      } = req.body;

      const user = await User.findOne({
        $or: [
          {
            email: email || "",
          },
          {
            phoneNumber:
              phoneNumber || "",
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const otp = generateOTP();

      user.otp = otp;

      user.otpExpiry = new Date(
        Date.now() + 5 * 60 * 1000
      );

      await user.save();

      if (language === "fr") {
        if (!user.email) {
          return res.status(400).json({
            success: false,
            message:
              "No registered email found.",
          });
        }

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,

          subject:
            "Twiller Language Change OTP",

          text: `
Your OTP for changing the language is ${otp}.
This OTP is valid for 5 minutes.
          `,
        });

        return res.status(200).json({
          success: true,
          message:
            "OTP sent to your registered email.",
          method: "email",
        });
      }

      if (!user.phoneNumber) {
        return res.status(400).json({
          success: false,
          message:
            "No registered phone number found.",
        });
      }

      console.log(
        `SMS OTP for ${user.phoneNumber}: ${otp}`
      );

      return res.status(200).json({
        success: true,
        message:
          "OTP sent to your registered phone number.",
        method: "phone",
      });
    } catch (error) {
      console.error(
        "Language OTP error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to send language change OTP",
      });
    }
  }
);

/* =========================================================
   VERIFY LANGUAGE OTP
========================================================= */

app.post(
  "/verify-language-otp",
  async (req, res) => {
    try {
      const {
        email,
        phoneNumber,
        otp,
        language,
      } = req.body;

      const user = await User.findOne({
        $or: [
          {
            email: email || "",
          },
          {
            phoneNumber:
              phoneNumber || "",
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.otp) {
        return res.status(400).json({
          success: false,
          message: "No OTP found",
        });
      }

      if (
        new Date() > user.otpExpiry
      ) {
        return res.status(400).json({
          success: false,
          message: "OTP expired",
        });
      }

      if (user.otp !== otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }

      user.preferredLanguage =
        language;

      user.otp = null;
      user.otpExpiry = null;

      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "Language updated successfully.",
        language,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Verification failed",
      });
    }
  }
);

/* =========================================================
   FORGOT PASSWORD
========================================================= */

app.post(
  "/forgot-password",
  async (req, res) => {
    try {
      const {
        email,
        phone,
      } = req.body;

      const user = await User.findOne({
        $or: [
          {
            email: email || "",
          },
          {
            phoneNumber:
              phone || "",
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.lastPasswordReset) {
        const last =
          new Date(
            user.lastPasswordReset
          );

        const today = new Date();

        const sameDay =
          last.getDate() ===
            today.getDate() &&
          last.getMonth() ===
            today.getMonth() &&
          last.getFullYear() ===
            today.getFullYear();

        if (sameDay) {
          return res.status(400).json({
            success: false,
            message:
              "You can use this option only one time per day.",
          });
        }
      }

      const resetLink =
        await adminAuth.generatePasswordResetLink(
          user.email
        );

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,

        subject:
          "Twiller Password Reset",

        html: `
          <h2>Password Reset</h2>

          <p>
            Click the button below to reset your password.
          </p>

          <a href="${resetLink}">
            <button
              style="
                background:#1d9bf0;
                color:white;
                padding:10px 20px;
                border:none;
                border-radius:6px;
              "
            >
              Reset Password
            </button>
          </a>

          <p>
            This link is generated by Firebase.
          </p>
        `,
      });

      user.lastPasswordReset =
        new Date();

      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "Password reset link has been sent to your email.",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Password reset failed",
      });
    }
  }
);

/* =========================================================
   AUDIO UPLOAD

   REQUIREMENTS:
   1. OTP authentication
   2. 2 PM - 7 PM IST
   3. Maximum 100 MB
   4. Maximum 5 minutes
========================================================= */

app.post(
  "/upload-audio",
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      /* =========================
         1. FILE CHECK
      ========================= */

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "No audio file uploaded",
        });
      }

      /* =========================
         2. EMAIL CHECK
      ========================= */

      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const emailKey =
        String(email).toLowerCase();

      /* =========================
         3. OTP CHECK
      ========================= */

      const audioOtp =
        audioOtpStore.get(emailKey);

      if (
        !audioOtp ||
        !audioOtp.verified
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Please verify OTP before uploading audio",
        });
      }

      /* =========================
         OTP VERIFICATION EXPIRY
      ========================= */

      if (
        !audioOtp.verifiedAt ||
        Date.now() -
          audioOtp.verifiedAt >
          5 * 60 * 1000
      ) {
        audioOtpStore.delete(emailKey);

        return res.status(403).json({
          success: false,
          message:
            "OTP verification expired. Please verify again.",
        });
      }

      /* =========================
         4. USER CHECK
      ========================= */

      const user = await User.findOne({
        email: emailKey,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      /* =========================
         5. AUDIO TYPE CHECK
      ========================= */

      if (
        !req.file.mimetype.startsWith(
          "audio/"
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only audio files are allowed",
        });
      }

      /* =========================
         6. 100 MB CHECK
      ========================= */

      const MAX_SIZE =
        100 * 1024 * 1024;

      if (req.file.size > MAX_SIZE) {
        return res.status(400).json({
          success: false,
          message:
            "Audio file cannot exceed 100 MB",
        });
      }

      /* =========================
         7. TIME CHECK
         2 PM - 7 PM IST
      ========================= */

      const now = new Date();

      const istString =
        now.toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        });

      const istTime =
        new Date(istString);

      const currentMinutes =
        istTime.getHours() * 60 +
        istTime.getMinutes();

      const startTime =
        14 * 60;

      const endTime =
        19 * 60;

      if (
        currentMinutes <
          startTime ||
        currentMinutes >= endTime
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Audio tweets are allowed only between 2:00 PM and 7:00 PM IST.",
        });
      }

      /* =========================
         8. DURATION CHECK
         MAX 5 MINUTES
      ========================= */

      console.log(
        "🎵 Reading audio metadata..."
      );

      const metadata =
        await parseFile(
          req.file.path
        );

      const duration =
        metadata.format.duration;

      console.log(
        "🎵 Audio duration:",
        duration
      );

      if (!duration) {
        return res.status(400).json({
          success: false,
          message:
            "Unable to determine audio duration",
        });
      }

      if (duration > 300) {
        return res.status(400).json({
          success: false,
          message:
            "Audio duration cannot exceed 5 minutes",
        });
      }

      /* =========================
         9. LOG FILE INFO
      ========================= */

      console.log(
        "🎵 Audio accepted:",
        {
          user: user.email,
          name:
            req.file.originalname,
          size: `${(
            req.file.size /
            1024 /
            1024
          ).toFixed(2)} MB`,
          type:
            req.file.mimetype,
          duration: `${duration.toFixed(
            2
          )} seconds`,
        }
      );

      /* =========================
         10. CLOUDINARY UPLOAD
      ========================= */

      console.log(
        "☁️ Uploading audio to Cloudinary..."
      );

      console.log("☁️ Uploading audio to Cloudinary...");

const result = await cloudinary.uploader.upload(
  req.file.path,
  {
    resource_type: "video",
    folder: "twiller-audio",
  }
);

console.log("☁️ Cloudinary upload response:", {
  public_id: result.public_id,
  resource_type: result.resource_type,
  format: result.format,
  secure_url: result.secure_url,
});
      const audioUrl =
        result?.secure_url;

      if (!audioUrl) {
        throw new Error(
          "Cloudinary did not return audio URL"
        );
      }

      console.log(
        "✅ AUDIO URL:",
        audioUrl
      );

      /* =========================
         11. CONSUME OTP
      ========================= */

      audioOtpStore.delete(
        emailKey
      );

      /* =========================
         12. SUCCESS
      ========================= */

      return res.status(200).json({
        success: true,
        message:
          "Audio uploaded successfully",
        url: audioUrl,
        duration,
      });
    } catch (error) {
      console.error(
        "🔥 AUDIO UPLOAD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Audio upload failed",
        error: error?.message,
      });
    } finally {
      /* =========================
         DELETE TEMP FILE
      ========================= */

      if (
        req.file?.path &&
        fs.existsSync(
          req.file.path
        )
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );

          console.log(
            "🗑️ Temporary audio file deleted"
          );
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

/* =========================================================
   IMAGE UPLOAD
========================================================= */

app.post(
  "/upload-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "No image uploaded",
        });
      }

      console.log(
        "📸 IMAGE FILE:",
        {
          name:
            req.file.originalname,

          size: `${(
            req.file.size /
            1024 /
            1024
          ).toFixed(2)} MB`,

          type:
            req.file.mimetype,

          path:
            req.file.path,
        }
      );

      const result =
        await cloudinary.uploader.upload(
          req.file.path,
          {
            resource_type:
              "image",

            folder:
              "twiller-images",
          }
        );

      if (
        !result?.secure_url
      ) {
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
        url:
          result.secure_url,
      });
    } catch (error) {
      console.error(
        "🔥 CLOUDINARY IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Image upload failed",
        error:
          error?.message,
      });
    } finally {
      if (
        req.file?.path &&
        fs.existsSync(
          req.file.path
        )
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );

          console.log(
            "🗑️ Temporary image deleted"
          );
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

/* =========================================================
   REGISTER
========================================================= */

app.post(
  "/register",
  async (req, res) => {
    try {
      const existinguser =
        await User.findOne({
          email:
            req.body.email,
        });

      if (existinguser) {
        return res
          .status(200)
          .send(existinguser);
      }

      const newUser =
        new User({
          ...req.body,

          subscriptionPlan:
            "FREE",

          subscriptionExpiry:
            null,

          tweetCount:
            0,
        });

      await newUser.save();

      return res
        .status(201)
        .send(newUser);
    } catch (error) {
      return res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);

/* =========================================================
   LOGGED IN USER
========================================================= */

app.get(
  "/loggedinuser",
  async (req, res) => {
    try {
      const {
        email,
        uid,
        browser,
      } = req.query;

      console.log(
        "LOGIN CHECK:"
      );

      console.log(
        "Email:",
        email
      );

      console.log(
        "Firebase UID:",
        uid
      );

      console.log(
        "Browser:",
        browser
      );

      if (!email) {
        return res.status(400).json({
          success: false,
          message:
            "Email required",
        });
      }

      if (!uid) {
        return res.status(400).json({
          success: false,
          message:
            "Firebase UID required",
        });
      }

      const user =
        await User.findOne({
          email:
            String(email)
              .toLowerCase(),
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }

      if (!user.uid) {
        user.uid =
          String(uid);

        console.log(
          "✅ Firebase UID added to existing user"
        );
      } else if (
        user.uid !==
        String(uid)
      ) {
        console.error(
          "❌ Firebase UID mismatch"
        );

        return res.status(403).json({
          success: false,
          message:
            "Firebase account does not match this user profile",
        });
      }

      const deviceInfo =
        getDeviceInfo(
          req.headers["user-agent"]
        );

      if (
        !isLoginAllowed(
          deviceInfo.deviceType
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Mobile login is allowed only between 10:00 AM and 1:00 PM.",
        });
      }

      user.loginHistory.push({
        browser:
          deviceInfo.browser,

        operatingSystem:
          deviceInfo.operatingSystem,

        deviceType:
          deviceInfo.deviceType,

        ipAddress:
          req.headers[
            "x-forwarded-for"
          ]?.split(",")[0] ||
          req.socket.remoteAddress,

        loginTime:
          new Date(),
      });

      await user.save();

      return res.status(200).json({
        success: true,

        requireOtp:
          true,

        email:
          user.email,

        user,

        deviceInfo,
      });
    } catch (error) {
      console.error(
        "🔥 /loggedinuser ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

/* =========================================================
   FIX USERS
========================================================= */

app.get(
  "/fix-users",
  async (req, res) => {
    await User.updateMany(
      {
        notificationsEnabled:
          {
            $exists: false,
          },
      },

      {
        $set: {
          notificationsEnabled:
            true,
        },
      }
    );

    res.send("Done");
  }
);

/* =========================================================
   FIX SUBSCRIPTIONS
========================================================= */

app.get(
  "/fix-subscriptions",
  async (req, res) => {
    await User.updateMany(
      {
        subscriptionPlan:
          {
            $exists: false,
          },
      },

      {
        $set: {
          subscriptionPlan:
            "FREE",

          subscriptionExpiry:
            null,

          tweetCount:
            0,
        },
      }
    );

    res.send(
      "Subscriptions updated successfully."
    );
  }
);

/* =========================================================
   UPDATE PROFILE
========================================================= */

app.patch(
  "/userupdate/:email",
  async (req, res) => {
    try {
      const {
        email,
      } = req.params;

      const updated =
        await User.findOneAndUpdate(
          {
            email,
          },

          {
            $set:
              req.body,
          },

          {
            new: true,
            upsert: false,
          }
        );

      return res
        .status(200)
        .send(updated);
    } catch (error) {
      return res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);

/* =========================================================
   NOTIFICATION PREFERENCE
========================================================= */

app.patch(
  "/notification/:email",
  async (req, res) => {
    try {
      const {
        email,
      } = req.params;

      const {
        notificationsEnabled,
      } = req.body;

      const user =
        await User.findOneAndUpdate(
          {
            email,
          },

          {
            notificationsEnabled,
          },

          {
            new: true,
          }
        );

      res
        .status(200)
        .send(user);
    } catch (error) {
      res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);

/* =========================================================
   CREATE RAZORPAY ORDER
========================================================= */

/* =========================================================
   CREATE RAZORPAY ORDER
   PAYMENT ALLOWED ONLY: 10:00 AM - 11:00 AM IST
========================================================= */

app.post(
  "/create-order",
  async (req, res) => {
    try {
      const { plan } = req.body;

      // ==========================================
      // PAYMENT TIME RESTRICTION
      // 10:00 AM - 11:00 AM IST
      // ==========================================

      const now = new Date();

      const indiaTime = new Date(
        now.toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );

      const currentMinutes =
        indiaTime.getHours() * 60 +
        indiaTime.getMinutes();

      const startTime = 10 * 60; // 10:00 AM
      const endTime = 11 * 60;   // 11:00 AM

      if (
        currentMinutes < startTime ||
        currentMinutes >= endTime
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Payments are allowed only between 10:00 AM and 11:00 AM IST.",
        });
      }

      // ==========================================
      // SUBSCRIPTION PRICES
      // ==========================================

      const prices = {
        BRONZE: 100,
        SILVER: 300,
        GOLD: 1000,
      };

      const amount = prices[plan];

      if (!amount) {
        return res.status(400).json({
          success: false,
          message: "Invalid Subscription Plan",
        });
      }

      // ==========================================
      // CREATE RAZORPAY ORDER
      // ==========================================

      const order = await razorpay.orders.create({
        amount: amount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });

      console.log(
        `✅ Razorpay order created for ${plan}: ₹${amount}`
      );

      res.send({
        success: true,
        order,
      });
    } catch (error) {
      console.error(
        "🔥 Razorpay order creation error:",
        error
      );

      res.status(500).send({
        success: false,
        message: "Failed to create order",
      });
    }
  }
);

/* =========================================================
   VERIFY PAYMENT
========================================================= */

app.post(
  "/verify-payment",
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        email,
        plan,
      } = req.body;

      const body =
        razorpay_order_id +
        "|" +
        razorpay_payment_id;

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
          )
          .update(
            body.toString()
          )
          .digest("hex");

      if (
        expectedSignature !==
        razorpay_signature
      ) {
        return res.status(400).send({
          success: false,
          message:
            "Invalid Payment Signature",
        });
      }

      const user =
        await User.findOne({
          email,
        });

      if (!user) {
        return res.status(404).send({
          success: false,
          message:
            "User not found",
        });
      }

      const expiry =
        new Date();

      expiry.setDate(
        expiry.getDate() + 30
      );

      const prices = {
        BRONZE:
          100,

        SILVER:
          300,

        GOLD:
          1000,
      };

      const invoiceId =
        "INV-" +
        Date.now();

      user.subscriptionPlan =
        plan;

      user.subscriptionExpiry =
        expiry;

      user.tweetCount =
        0;

      await user.save();

      await transporter.sendMail({
        from:
          process.env.EMAIL_USER,

        to:
          user.email,

        subject:
          "Twiller Subscription Invoice",

        html: `

          <h2>
            Twiller Subscription Successful
          </h2>

          <hr/>

          <p>
            <strong>Invoice ID:</strong>
            ${invoiceId}
          </p>

          <p>
            <strong>Plan:</strong>
            ${plan}
          </p>

          <p>
            <strong>Amount:</strong>
            ₹${prices[plan]}
          </p>

          <p>
            <strong>Purchase Date:</strong>
            ${new Date().toLocaleString()}
          </p>

          <p>
            <strong>Expiry Date:</strong>
            ${expiry.toDateString()}
          </p>

          <hr/>

          <h3>
            Thank you for purchasing Twiller Premium.
          </h3>

        `,
      });

      res.send({
        success:
          true,

        message:
          "Subscription Activated Successfully",
      });
    } catch (error) {
      console.error(error);

      res.status(500).send({
        success:
          false,

        message:
          "Payment Verification Failed",
      });
    }
  }
);

/* =========================================================
   LOGIN HISTORY
========================================================= */

app.post(
  "/login-history",
  async (req, res) => {
    try {
      const {
        email,
      } = req.body;

      if (!email) {
        return res.status(400).json({
          message:
            "Email is required",
        });
      }

      const userAgent =
        req.headers[
          "user-agent"
        ] || "";

      const deviceInfo =
        getDeviceInfo(
          userAgent
        );

      const ipAddress =
        req.headers[
          "x-forwarded-for"
        ]?.split(",")[0] ||
        req.socket.remoteAddress ||
        "Unknown";

      const loginRecord =
        new LoginHistory({
          email,

          browser:
            deviceInfo.browser,

          operatingSystem:
            deviceInfo.operatingSystem,

          device:
            deviceInfo.device,

          ipAddress,
        });

      await loginRecord.save();

      res.status(201).json({
        success:
          true,

        message:
          "Login history saved",

        loginRecord,
      });
    } catch (error) {
      console.error(
        "Login history error:",
        error
      );

      res.status(500).json({
        success:
          false,

        message:
          "Failed to save login history",
      });
    }
  }
);

/* =========================================================
   CREATE TWEET
========================================================= */

app.post(
  "/post",
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.body.author
        );

      if (!user) {
        return res.status(404).send({
          success:
            false,

          message:
            "User not found",
        });
      }

      /* ---------------------------------------------
         CHECK SUBSCRIPTION
      --------------------------------------------- */

      if (
        user.subscriptionExpiry &&
        new Date() >
          user.subscriptionExpiry
      ) {
        user.subscriptionPlan =
          "FREE";

        user.subscriptionExpiry =
          null;

        user.tweetCount =
          0;

        await user.save();
      }

      /* ---------------------------------------------
         AUDIO TIME RESTRICTION
      --------------------------------------------- */

      if (req.body.audio) {
        if (
          !isAudioUploadTimeAllowed()
        ) {
          return res.status(403).json({
            success:
              false,

            message:
              "Audio tweets can only be posted between 2:00 PM and 7:00 PM IST.",
          });
        }
      }

      /* ---------------------------------------------
         TWEET LIMIT
      --------------------------------------------- */

      const limits = {
        FREE:
          1,

        BRONZE:
          3,

        SILVER:
          5,

        GOLD:
          Infinity,
      };

      const limit =
        limits[
          user.subscriptionPlan
        ];

      if (
        user.tweetCount >=
        limit
      ) {
        return res.status(400).send({
          success:
            false,

          message:
            `Tweet limit reached for ${user.subscriptionPlan} plan. Please upgrade your subscription.`,
        });
      }

      const tweet =
        new Tweet(
          req.body
        );

      await tweet.save();

      user.tweetCount +=
        1;

      await user.save();

      const keywords = [
        "cricket",
        "science",
      ];

      const shouldNotify =
        keywords.some(
          (word) =>
            tweet.content
              .toLowerCase()
              .includes(word)
        );

      console.log(
        "Keyword Found:",
        shouldNotify
      );

      const populatedTweet =
        await Tweet.findById(
          tweet._id
        ).populate(
          "author"
        );

      res
        .status(201)
        .send(
          populatedTweet
        );
    } catch (error) {
      res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);

/* =========================================================
   GET ALL TWEETS
========================================================= */

app.get(
  "/post",
  async (req, res) => {
    try {
      const tweets =
        await Tweet.find()
          .sort({
            timestamp:
              -1,
          })
          .populate(
            "author"
          );

      return res
        .status(200)
        .send(tweets);
    } catch (error) {
      return res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);

/* =========================================================
   LIKE TWEET
========================================================= */

app.post(
  "/like/:tweetid",
  async (req, res) => {
    try {
      const {
        userId,
      } = req.body;

      const tweet =
        await Tweet.findById(
          req.params.tweetid
        );

      if (!tweet) {
        return res.status(404).json({
          message:
            "Tweet not found",
        });
      }

      if (
        !tweet.likedBy.includes(
          userId
        )
      ) {
        tweet.likes +=
          1;

        tweet.likedBy.push(
          userId
        );

        await tweet.save();
      }

      res.send(tweet);
    } catch (error) {
      return res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);

/* =========================================================
   RETWEET
========================================================= */

app.post(
  "/retweet/:tweetid",
  async (req, res) => {
    try {
      const {
        userId,
      } = req.body;

      const tweet =
        await Tweet.findById(
          req.params.tweetid
        );

      if (!tweet) {
        return res.status(404).json({
          message:
            "Tweet not found",
        });
      }

      if (
        !tweet.retweetedBy.includes(
          userId
        )
      ) {
        tweet.retweets +=
          1;

        tweet.retweetedBy.push(
          userId
        );

        await tweet.save();
      }

      res.send(tweet);
    } catch (error) {
      return res
        .status(400)
        .send({
          error:
            error.message,
        });
    }
  }
);