import mongoose from "mongoose";

const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },

  uid: {
    type: String,
    required: true,
  },

  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },

  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },

  notificationsEnabled: {
    type: Boolean,
    default: true,
  },

  joinedDate: {
    type: Date,
    default: Date.now,
  },
  otp: {
  type: String,
  default: null,
},

otpExpiry: {
  type: Date,
  default: null,
},

preferredLanguage: {
  type: String,
  enum: ["en", "hi", "es", "pt", "fr", "zh"],
  default: "en",
},

  lastPasswordReset: {
    type: Date,
    default: null,
  },

  subscriptionPlan: {
    type: String,
    enum: ["FREE", "BRONZE", "SILVER", "GOLD"],
    default: "FREE",
  },

  subscriptionExpiry: {
    type: Date,
    default: null,
  },

  tweetCount: {
    type: Number,
    default: 0,
  },

  phoneNumber: {
    type: String,
    default: "",
  },
  loginHistory: [
  {
    browser: String,
    operatingSystem: String,
    deviceType: String,
    ipAddress: String,
    loginTime: {
      type: Date,
      default: Date.now,
    },
  },
],

  // 🌍 Selected language
  language: {
    type: String,
    enum: ["en", "hi", "es", "pt", "fr", "zh"],
    default: "en",
  },
});

export default mongoose.model("User", UserSchema);