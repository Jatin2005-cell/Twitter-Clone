import { UAParser } from "ua-parser-js";

export const getDeviceInfo = (userAgent) => {
  const parser = new UAParser(userAgent);

  const result = parser.getResult();

  return {
    browser: result.browser.name || "Unknown",
    operatingSystem: result.os.name || "Unknown",
    device:
      result.device.type === "mobile"
        ? "Mobile"
        : result.device.type === "tablet"
        ? "Tablet"
        : "Desktop",
  };
};