import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from "expo-alternate-app-icons";

export type AppIconName = "default" | "Rupee";

export const appIconSupported = supportsAlternateIcons;

export function currentAppIcon(): AppIconName {
  return getAppIconName() === "Rupee" ? "Rupee" : "default";
}

export async function setAppIcon(name: AppIconName): Promise<void> {
  await setAlternateAppIcon(name === "default" ? null : name);
}
