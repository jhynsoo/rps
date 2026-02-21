import { NextResponse } from "next/server";

import { resolveLocale } from "@/lib/locale";

type LocaleRequestBody = {
  locale?: string | null;
};

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

const getRequestedLocale = async (request: Request): Promise<string | undefined> => {
  try {
    const body = (await request.json()) as LocaleRequestBody;
    return typeof body?.locale === "string" ? body.locale : undefined;
  } catch {
    return undefined;
  }
};

export async function POST(request: Request) {
  const requestedLocale = await getRequestedLocale(request);
  const locale = resolveLocale(requestedLocale, null);
  const isProduction = process.env.NODE_ENV === "production";

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set("locale", locale, {
    path: "/",
    sameSite: "lax",
    secure: isProduction,
    maxAge: ONE_YEAR_IN_SECONDS,
  });
  return response;
}
