import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

import { LanguageToggle } from "./components/LanguageToggle";

export const metadata: Metadata = {
  title: "RPS Game",
  description: "Online Rock-Paper-Scissors game",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const htmlLang = locale === "en" ? "en" : "ko";

  return (
    <html lang={htmlLang}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageToggle />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
