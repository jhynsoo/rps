import { NextResponse } from "next/server";

import { resolveLocale } from "@/lib/locale";

type LocaleRequestBody = {
  locale?: string | null;
};

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

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set("locale", locale, { path: "/" });
  return response;
}
