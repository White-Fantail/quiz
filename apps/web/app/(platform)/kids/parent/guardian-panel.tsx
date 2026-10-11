"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslation } from "../../../../src/i18n/provider";
import { localizeHref } from "../../../../src/i18n/core";

type Profile={id:string;nickname:string;ageBand:"EARLY"|"MIDDLE"|"OLDER";locale:"en"|"ko";sessionMinutes:number};
type Device={id:string;profileId:string;deviceName:string;createdAt:string;expiresAt:string};
type Overview={pinConfigured:boolean;profiles:Profile[];devices:Device[]};
const defaultProfile={nickname:"",ageBand:"MIDDLE" as const,locale:"en" as const,sessionMinutes:0};
type FormProfile=Pick<Profile,"nickname"|"ageBand"|"locale"|"sessionMinutes">;
async function api(path:string,method:"GET"|"POST"="GET",body?:unknown) {
  const response=await fetch("/api/kids/"+path,{
    method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message??data.error??"Request failed");
  return data.data;
}
export default function GuardianPanel() {
  const t=useTranslation(),locale=useLocale();
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [pin,setPin]=useState(""),[oldPin,setOldPin]=useState("");
  const [profile,setProfile]=useState<FormProfile>({...defaultProfile});
  const [activeProfile,setActiveProfile]=useState("");
  const [deviceName,setDeviceName]=useState("My iPad");
  const [activationPin,setActivationPin]=useState("");
  const [editingId,setEditingId]=useState("");
  const [editing,setEditing]=useState<FormProfile>({...defaultProfile});
  const refresh=useCallback(async()=>setOverview(await api("parent")),[]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e))).finally(()=>setLoading(false));},[refresh]);
  async function perform(action:Record<string,unknown>, after?:()=>void) {
    setBusy(true);setError("");setNotice("");
    try{
      await api("parent","POST",action);
      await refresh();
      setNotice(t("kids.guardian.saved"));
      after?.();
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  function updateProfile(key:keyof FormProfile,value:string,edit=false) {
    const assign=(v:FormProfile)=>({...v,[key]:key==="sessionMinutes"?Number(value):value});
    if(edit)setEditing(assign);else setProfile(assign);
  }
  if(loading)return <p className="kids-notice" role="status">{t("common.loading")}</p>;
  if(!overview)return <p className="kids-notice" role="alert">{error||t("kids.guardian.loadError")}</p>;
  const formFields=(current:FormProfile,edit=false)=><div className="kids-guardian-fields">
    <label>{t("kids.guardian.nickname")}
      <input maxLength={32} required value={current.nickname} onChange={e=>updateProfile("nickname",e.target.value,edit)}/>
    </label>
    <label>{t("kids.guardian.ageBand")}
      <select value={current.ageBand} onChange={e=>updateProfile("ageBand",e.target.value,edit)}>
        <option value="EARLY">{t("kids.guardian.early")}</option>
        <option value="MIDDLE">{t("kids.guardian.middle")}</option>
        <option value="OLDER">{t("kids.guardian.older")}</option>
      </select>
    </label>
    <label>{t("kids.guardian.language")}
      <select value={current.locale} onChange={e=>updateProfile("locale",e.target.value,edit)}>
        <option value="en">English</option><option value="ko">한국어</option>
      </select>
    </label>
    <label>{t("kids.guardian.sessionLength")}
      <select value={current.sessionMinutes} onChange={e=>updateProfile("sessionMinutes",e.target.value,edit)}>
        <option value={0}>{t("kids.guardian.unlimited")}</option>
        {[15,30,60,120].map(min=><option key={min} value={min}>{min} {t("kids.guardian.minutes")}</option>)}
      </select>
    </label>
  </div>;
  return <div className="kids-guardian-dashboard">
    {error&&<p role="alert" className="kids-notice">{error}</p>}
    {notice&&<p role="status" className="kids-notice">{notice}</p>}
    <section className="kids-guardian-card">
      <h2>🔐 {t("kids.guardian.pinTitle")}</h2>
      <p>{t("kids.guardian.pinExplain")}</p>
      <form onSubmit={(e:FormEvent)=>{e.preventDefault();void perform({
        action:overview.pinConfigured?"pin_change":"pin_setup",pin,...(overview.pinConfigured?{previous:oldPin}:{})
      },()=>{setPin("");setOldPin("");});}}>
        {overview.pinConfigured&&<label>{t("kids.guardian.previousPin")}
          <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off"
            required value={oldPin} onChange={e=>setOldPin(e.target.value)}/></label>}
        <label>{overview.pinConfigured?t("kids.guardian.newPin"):t("kids.guardian.setPin")}
          <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off"
            required value={pin} onChange={e=>setPin(e.target.value)}/></label>
        <button type="submit" className="kids-guardian-button" disabled={busy||pin.length!==6}>
          {overview.pinConfigured?t("kids.guardian.changePin"):t("kids.guardian.createPin")}
        </button>
      </form>
      {overview.pinConfigured&&<details className="kids-pin-recovery">
        <summary>{t("kids.guardian.forgotPin")}</summary>
        <p>{t("kids.guardian.resetHelp")}</p>
        <button type="button" disabled={busy||pin.length!==6} onClick={()=>void perform({action:"pin_reset",pin},()=>setPin(""))}>
          {t("kids.guardian.resetPin")}
        </button>
      </details>}
    </section>
    <section className="kids-guardian-card">
      <h2>🧒 {t("kids.guardian.profiles")}</h2>
      {overview.profiles.map(child=><div className="kids-guardian-child" key={child.id}>
        <div className="kids-guardian-row"><strong>{child.nickname}</strong><span>{child.locale.toUpperCase()}</span>
          <button type="button" disabled={busy} onClick={()=>{setEditingId(child.id);setEditing(child);}}>
            {t("kids.guardian.edit")}
          </button></div>
        {editingId===child.id&&<form onSubmit={e=>{e.preventDefault();void perform({
          action:"profile_update",id:child.id,...editing
        },()=>setEditingId(""));}}>
          {formFields(editing,true)}
          <div className="kids-guardian-actions">
            <button className="kids-guardian-button" disabled={busy}>{t("kids.guardian.save")}</button>
            <button type="button" onClick={()=>setEditingId("")}>{t("kids.guardian.cancel")}</button>
            <button type="button" disabled={busy} onClick={()=>{if(window.confirm(t("kids.guardian.deleteConfirm")))void perform({action:"profile_delete",id:child.id});}}>
              {t("kids.guardian.delete")}
            </button>
          </div>
        </form>}
      </div>)}
      {overview.profiles.length<8&&<form onSubmit={e=>{e.preventDefault();void perform({action:"profile_add",...profile},()=>setProfile({...defaultProfile}));}}>
        <h3>{t("kids.guardian.addProfile")}</h3>
        {formFields(profile)}
        <button className="kids-guardian-button" disabled={busy}>{t("kids.guardian.add")}</button>
      </form>}
    </section>
    <section className="kids-guardian-card">
      <h2>📱 {t("kids.guardian.deviceTitle")}</h2>
      <p>{t("kids.guardian.deviceHelp")}</p>
      <form onSubmit={async e=>{
        e.preventDefault();setBusy(true);setError("");
        try{
          const selected=overview.profiles.find(x=>x.id===activeProfile)??overview.profiles[0];
          if(!selected)throw new Error(t("kids.guardian.needProfile"));
          const result=await api("device","POST",{profileId:selected.id,deviceName,pin:activationPin});
          location.assign(localizeHref("/kids",result.locale));
        }catch(e){setError(e instanceof Error?e.message:String(e));setBusy(false);}
      }}>
        <label>{t("kids.guardian.selectChild")}
          <select required value={activeProfile||overview.profiles[0]?.id||""} onChange={e=>setActiveProfile(e.target.value)}>
            {overview.profiles.map(child=><option key={child.id} value={child.id}>{child.nickname}</option>)}
          </select>
        </label>
        <label>{t("kids.guardian.deviceName")}
          <input required maxLength={50} value={deviceName} onChange={e=>setDeviceName(e.target.value)}/>
        </label>
        <label>{t("kids.guardian.confirmPin")}
          <input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            autoComplete="off" value={activationPin} onChange={e=>setActivationPin(e.target.value)}/>
        </label>
        <button className="kids-guardian-button" disabled={busy||!overview.pinConfigured||!overview.profiles.length||activationPin.length!==6}>
          {t("kids.guardian.activate")}
        </button>
      </form>
      <p className="kids-explore-note">{t("kids.guardian.deviceNote")}</p>
      <h3>{t("kids.guardian.activeDevices")}</h3>
      {overview.devices.length===0?<p>{t("kids.guardian.noDevices")}</p>:
      overview.devices.map(device=><div className="kids-guardian-row" key={device.id}>
        <span>{device.deviceName} · {overview.profiles.find(p=>p.id===device.profileId)?.nickname||"—"}</span>
        <button type="button" disabled={busy} onClick={()=>{if(window.confirm(t("kids.guardian.revokeConfirm")))void perform({action:"device_revoke",id:device.id});}}>
          {t("kids.guardian.revoke")}
        </button>
      </div>)}
    </section>
  </div>;
}
