import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },

    browser: {
      type: String,
      required: true,
    },

    operatingSystem: {
      type: String,
      required: true,
    },

    device: {
      type: String,
      required: true,
    },

    ipAddress: {
      type: String,
      required: true,
    },

    loginTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "LoginHistory",
  loginHistorySchema
);