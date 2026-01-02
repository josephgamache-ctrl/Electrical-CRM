import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchUserSettings, persistUserSettings } from "../api";
import logger from "../utils/logger";

const DEFAULT_SETTINGS = {
  theme: "light",
  textScale: 1.0,
  columnVisibility: {},
};

const loadStoredSettings = () => {
  try {
    const raw = localStorage.getItem("userSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    logger.error("Failed to parse stored user settings:", error);
  }
  return DEFAULT_SETTINGS;
};

const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(loadStoredSettings);

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      const remoteSettings = await fetchUserSettings();
      if (remoteSettings && isMounted) {
        setSettings((prev) => {
          const merged = { ...prev, ...remoteSettings };
          localStorage.setItem("userSettings", JSON.stringify(merged));
          return merged;
        });
      }
    };

    bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSettings = (partialSettings) => {
    setSettings((prev) => {
      const merged = { ...prev, ...partialSettings };
      localStorage.setItem("userSettings", JSON.stringify(merged));
      persistUserSettings(merged);
      return merged;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export { SettingsContext };
export const useSettings = () => useContext(SettingsContext);
