import { RELEASE } from "../consts";

export type OS = "windows" | "macos" | "linux" | "unknown";

// Android UAs contain "Linux" too, so it must be ruled out before the linux
// match, and Mac/Linux must both be checked before a generic "win" match.
export function detectOS(userAgent: string): OS {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macos";
  if (ua.includes("android")) return "unknown";
  if (ua.includes("linux")) return "linux";
  if (ua.includes("win")) return "windows";
  return "unknown";
}

interface DownloadEntry {
  label: string;
  sub: string;
  href: string;
}

// "unknown" mirrors the Windows entry so no-JS and undetected visitors see
// exactly the default that was already on the page before this existed.
export const OS_DOWNLOADS: Record<OS, DownloadEntry> = {
  windows: { label: "Download for Windows", sub: "x64 · 26.02", href: `${RELEASE}/7z2602-x64.exe` },
  macos: { label: "Download for macOS", sub: "26.02", href: `${RELEASE}/7z2602-mac.tar.xz` },
  linux: { label: "Download for Linux", sub: "x86-64 · 26.02", href: `${RELEASE}/7z2602-linux-x64.tar.xz` },
  unknown: { label: "Download for Windows", sub: "x64 · 26.02", href: `${RELEASE}/7z2602-x64.exe` },
};
