"use client";

import { nanoid } from "nanoid";

const DEVICE_KEY = "session-app-device";

interface DeviceIdentity {
  deviceId: string;
  name: string;
  avatarUrl: string;
}

export function getDeviceIdentity(): DeviceIdentity {
  if (typeof window === "undefined") {
    return { deviceId: "", name: "", avatarUrl: "" };
  }

  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  const identity: DeviceIdentity = {
    deviceId: nanoid(),
    name: "",
    avatarUrl: "",
  };

  localStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
  return identity;
}

export function updateDeviceIdentity(updates: Partial<DeviceIdentity>) {
  const current = getDeviceIdentity();
  const updated = { ...current, ...updates };
  localStorage.setItem(DEVICE_KEY, JSON.stringify(updated));
  return updated;
}
