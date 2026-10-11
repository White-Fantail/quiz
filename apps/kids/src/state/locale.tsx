import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { DEFAULT_LOCALE, type Locale } from "@quizdip/i18n";
import { kidsT, type KidsMessageKey } from "@quizdip/i18n/kids";

type Context = { locale: Locale; chooseLocale: (locale: Locale) => void; t: (key: KidsMessageKey) => string };
const LocaleContext = createContext<Context | null>(null);

/** Phase 1 preview language, replaced by guardian-pinned locale in Phase 2. */
export function KidsLocaleProvider({children}:PropsWithChildren) {
  const [locale,chooseLocale] = useState<Locale>(DEFAULT_LOCALE);
  const value = useMemo<Context>(()=>({locale,chooseLocale,t:(key)=>kidsT(locale,key)}),[locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useKidsLocale(): Context {
  const value=useContext(LocaleContext);
  if(!value) throw new Error("Missing KidsLocaleProvider");
  return value;
}
