export const isLoginAllowed = (deviceType) => {
  // Desktop/Laptop -> Always allow
  if (
    deviceType === "Desktop" ||
    deviceType === "Laptop" ||
    !deviceType
  ) {
    return true;
  }

  // Mobile -> Only 10 AM to 1 PM
  if (deviceType === "Mobile") {
    const now = new Date();
    const hour = now.getHours();

    return hour >= 10 && hour < 13;
  }

  // Other device types -> allow
  return true;
};