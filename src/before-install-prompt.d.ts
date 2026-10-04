// `beforeinstallprompt` is a non-standard (Chromium) PWA install event that is
// absent from TypeScript's DOM lib. Declared here so it can be typed without
// `any` (see SettingsView's "Install app" flow).
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
