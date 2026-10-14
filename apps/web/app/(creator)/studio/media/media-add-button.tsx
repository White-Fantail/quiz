"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";

/** Preserve client-side search filters when opening the creation flow. */
export default function MediaAddButton({children}:{children:ReactNode}) {
  const router=useRouter();
  const locale=useLocale();
  return <button type="button" className="btn btn-primary" onClick={()=>{
    const from=window.location.pathname+window.location.search;
    router.push(localizeHref("/studio/media/new",locale)+"?returnTo="+encodeURIComponent(from));
  }}>{children}</button>;
}
