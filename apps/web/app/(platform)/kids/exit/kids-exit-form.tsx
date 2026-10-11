"use client";
import { useState, type FormEvent } from "react";
import { useLocale,useTranslation } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";
export default function KidsExitForm(){
  const t=useTranslation(),locale=useLocale();
  const [pin,setPin]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(e:FormEvent){
    e.preventDefault();if(pin.length!==6)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/kids/device",{method:"DELETE",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({pin})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.message||body.error||t("kids.exit.error"));
      location.replace(localizeHref("/kids/parent",locale));
    }catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);setPin("");}
  }
  return <form className="kids-exit-form" onSubmit={e=>void submit(e)}>
    <label htmlFor="guardian-exit-pin">{t("kids.exit.pin")}</label>
    <input id="guardian-exit-pin" type="password" inputMode="numeric" pattern="[0-9]{6}"
      autoComplete="off" maxLength={6} required value={pin} onChange={e=>setPin(e.target.value)}/>
    <button type="submit" className="kids-guardian-button" disabled={busy||pin.length!==6}>
      {busy?t("common.loading"):t("kids.exit.confirm")}
    </button>
    {error&&<p className="kids-notice" role="alert">{error}</p>}
    <p className="kids-explore-note">{t("kids.exit.help")}</p>
  </form>;
}
