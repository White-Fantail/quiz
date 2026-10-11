import { db } from "./db";
import { requireActor, type Actor } from "./auth";
import { LOCALES } from "../../i18n/core";

export async function localeGet(_p: Record<string, unknown>, actor: Actor | null) {
  const user = requireActor(actor);
  const result = await db().user.findUniqueOrThrow({
    where: { id: user.id },
    select: { uiLocale: true, contentLocale: true }
  });
  return { ...result, supportedLocales: [...LOCALES] };
}
export async function localeUpdate(p: Record<string, any>, actor: Actor | null) {
  const user = requireActor(actor);
  const result = await db().user.update({
    where: { id: user.id },
    data: { uiLocale: p.locale, contentLocale: p.locale },
    select: { uiLocale: true, contentLocale: true }
  });
  return { ...result, supportedLocales: [...LOCALES] };
}
