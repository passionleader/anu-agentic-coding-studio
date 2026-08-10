import { describe, expect, it } from "vitest";
import { detectOS, OS_DOWNLOADS } from "./detect-os";

const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const MACOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("detectOS", () => {
  it("recognises Windows", () => {
    expect(detectOS(WINDOWS_UA)).toBe("windows");
  });

  it("recognises macOS", () => {
    expect(detectOS(MACOS_UA)).toBe("macos");
  });

  it("recognises Linux", () => {
    expect(detectOS(LINUX_UA)).toBe("linux");
  });

  it("does not mistake Android for Linux", () => {
    expect(detectOS(ANDROID_UA)).toBe("unknown");
  });

  it("falls back to unknown for anything else", () => {
    expect(detectOS(BOT_UA)).toBe("unknown");
  });
});

describe("OS_DOWNLOADS", () => {
  it("falls back to the Windows entry for unknown, so no-JS visitors see today's default", () => {
    expect(OS_DOWNLOADS.unknown.href).toBe(OS_DOWNLOADS.windows.href);
  });

  it("every entry points at a real GitHub release asset", () => {
    for (const entry of Object.values(OS_DOWNLOADS)) {
      expect(entry.href).toMatch(/^https:\/\/github\.com\/ip7z\/7zip\/releases\/download\//);
    }
  });
});
