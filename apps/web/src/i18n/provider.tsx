"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./core";
import { t, type MessageKey } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useLocale(): Locale { return useContext(LocaleContext); }
export function useTranslation(): (key: MessageKey) => string {
  const locale = useLocale();
  return key => t(locale, key);
}
