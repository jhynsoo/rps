import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { resolveLocale } from "@/lib/locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestHeaders = await headers();

  const locale = resolveLocale(
    cookieStore.get("locale")?.value,
    requestHeaders.get("accept-language"),
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
