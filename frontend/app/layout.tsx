import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../src/App.css";
import "../src/components/Chat.css";
import "../src/components/ConfirmModal.css";
import "../src/components/MeetingSummary.css";
import "../src/components/MissedMessages.css";
import "../src/components/MissedSpeech.css";
import "../src/components/Settings.css";
import "../src/components/ui/theme-switch-button.css";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SmartMeet",
  description: "AI-powered video meeting platform",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
