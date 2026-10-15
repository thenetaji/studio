export type AppIconName = "default" | "Rupee";

export const appIconSupported = false;

export const currentAppIcon = (): AppIconName => "default";

export async function setAppIcon(): Promise<void> {}
