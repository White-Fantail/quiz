"use client";

import { useCallback,useEffect,useState,type FormEvent } from "react";
import { useLocale,useTranslation } from "../../../src/i18n/provider";
import PairApproval from "./pair-approval";

type Profile = {id:string;nickname:string;ageBand:"EARLY"|"MIDDLE"|"OLDER";locale:"en"|"ko";sessionMinutes:number};
type Device = {id:string;profileId:string;deviceName:string;createdAt:string;expiresAt:string};
type Overview = {pinConfigured:boolean;profiles:Profile[];devices:Device[]};
type FormProfile = Pick<Profile,"nickname"|"ageBand"|"locale"|"sessionMinutes">;
const blank:FormProfile={nickname:"",ageBand:"MIDDLE",locale:"en",sessionMinutes:0};

async function parentRequest(method:"GET"|"POST"="GET",action?:object):Promise<any>{
 const response=await fetch("/api/account/kids",{
   method,credentials:"same-origin",cache:"no-store",
   ...(action?{headers:{"Content-Type":"application/json"},body:JSON.stringify(action)}:{})
 });
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(body?.message??body?.error??"Request failed");
 return body?.data;
}
/** Bootstrap is an ADULT account setting, never a child game or browser kid session. */
export default function KidsFamilySettings(){
 const t=useTranslation(),locale=useLocale();
 const [overview,setOverview]=useState<Overview|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [pin,setPin]=useState(""),[oldPin,setOldPin]=useState("");
 const [draft,setDraft]=useState<FormProfile>({...blank});
 const [editing,setEditing]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
   const next=await parentRequest();
   setOverview(next);
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(String(e))).finally(()=>setLoading(false));},[refresh]);
 async function run(action:object,done?:()=>void){
   if(busy)return;
   setBusy(true);setError("");setNotice("");
   try{
     await parentRequest("POST",action);await refresh();
     setNotice(t("kids.guardian.saved"));done?.();
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
 }
 const input=(key:keyof FormProfile,value:string)=>{
   setDraft(prev=>({...prev,[key]:key==="sessionMinutes"?Number(value):value}));
 };
 const fields=<div className="family-kids-fields">
   <label className="kids-form-field kids-form-field-wide">{t("kids.guardian.nickname")}
     <input required maxLength={32} value={draft.nickname}
       onChange={e=>input("nickname",e.target.value)}/></label>
   <label className="kids-form-field">{t("kids.guardian.ageBand")}
     <select value={draft.ageBand} onChange={e=>input("ageBand",e.target.value)}>
       <option value="EARLY">{t("kids.guardian.early")}</option>
       <option value="MIDDLE">{t("kids.guardian.middle")}</option>
       <option value="OLDER">{t("kids.guardian.older")}</option>
     </select>
   </label>
   <label className="kids-form-field">{t("kids.guardian.language")}
     <select value={draft.locale} onChange={e=>input("locale",e.target.value)}>
       <option value="en">English</option><option value="ko">한국어</option>
     </select></label>
   <p className="kids-form-hint">{locale==="ko"?
     "새 자녀의 기본 이용 시간은 하루 30분, 연속 30분이에요. 이후 Kids 앱의 보호자 공간에서 바꿀 수 있어요.":
     "New child profiles start with a 30-minute daily and continuous play allowance. Adjust these limits later in the app's Parents area."}</p>
 </div>;
 if(loading)return <p role="status">{t("common.loading")}</p>;
 if(!overview)return <p role="alert" className="feedback">{error||t("kids.guardian.loadError")}</p>;
 return <div className="kids-settings-stack">
   {error&&<p className="feedback" role="alert">{error}</p>}
   {notice&&<p className="feedback success" role="status">{notice}</p>}
   <section className="placeholder-panel kids-settings-card">
     <div className="kids-section-header">
       <span className="kids-step" aria-hidden="true">01</span>
       <div>
         <h2>{t("kids.guardian.pinTitle")}</h2>
         <p className="muted">{t("kids.guardian.pinExplain")}</p>
       </div>
     </div>
     <form className="kids-settings-form kids-pin-form" onSubmit={(e:FormEvent)=>{e.preventDefault();void run({
       action:overview.pinConfigured?"pin_change":"pin_setup",pin,
       ...(overview.pinConfigured?{previous:oldPin}:{})
     },()=>{setPin("");setOldPin("");});}}>
       <div className="kids-form-fields">
         {overview.pinConfigured&&<label className="kids-form-field">{t("kids.guardian.previousPin")}
           <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
             autoComplete="off" required value={oldPin} onChange={e=>setOldPin(e.target.value.replace(/\D/g,""))}/></label>}
         <label className="kids-form-field">{overview.pinConfigured?t("kids.guardian.newPin"):t("kids.guardian.setPin")}
           <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
             autoComplete="off" required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></label>
         <button className="btn btn-primary" disabled={busy||pin.length!==6}>
           {overview.pinConfigured?t("kids.guardian.changePin"):t("kids.guardian.createPin")}
         </button>
       </div>
     </form>
     {overview.pinConfigured&&<details className="kids-pin-recovery">
       <summary>{t("kids.guardian.forgotPin")}</summary>
       <p className="muted">{t("kids.guardian.resetHelp")}</p>
       <button type="button" disabled={busy||pin.length!==6} className="btn btn-outline"
         onClick={()=>void run({action:"pin_reset",pin},()=>setPin(""))}>
         {t("kids.guardian.resetPin")}
       </button>
     </details>}
   </section>
   <section className="placeholder-panel kids-settings-card">
     <div className="kids-section-header">
       <span className="kids-step" aria-hidden="true">02</span>
       <h2>{t("kids.guardian.profiles")}</h2>
     </div>
     <div className="kids-settings-list">
       {overview.profiles.map(p=><div key={p.id} className="kids-settings-list-row">
         <div className="kids-profile-info">
           <strong>{p.nickname}</strong>
           <span className="kids-profile-meta">{p.locale.toUpperCase()} · {p.ageBand==="EARLY"?t("kids.guardian.early"):p.ageBand==="MIDDLE"?t("kids.guardian.middle"):t("kids.guardian.older")}</span>
         </div>
         <button type="button" className="btn btn-outline" disabled={busy}
           onClick={()=>{setEditing(p.id);setDraft({...p});}}>
           {t("kids.guardian.edit")}
         </button>
       </div>)}
     </div>
     {(overview.profiles.length<8||editing)&&<form className="kids-profile-editor" onSubmit={e=>{e.preventDefault();void run(
       editing?{action:"profile_update",id:editing,...draft}:{action:"profile_add",...draft},
       ()=>{setEditing(null);setDraft({...blank});}
     );}}>
       <h3>{editing?t("kids.guardian.edit"):t("kids.guardian.addProfile")}</h3>
       {fields}
       <div className="actions kids-form-actions">
         <button className="btn btn-primary" disabled={busy||!draft.nickname.trim()}>
           {editing?t("kids.guardian.save"):t("kids.guardian.add")}
         </button>
         {editing&&<button type="button" className="btn btn-outline"
           onClick={()=>{setEditing(null);setDraft({...blank});}}>{t("kids.guardian.cancel")}</button>}
         {editing&&<button type="button" className="text-button" disabled={busy}
           onClick={()=>{if(window.confirm(t("kids.guardian.deleteConfirm")))
             void run({action:"profile_delete",id:editing},()=>{setEditing(null);setDraft({...blank});});}}>
           {t("kids.guardian.delete")}
         </button>}
       </div>
     </form>}
   </section>
   <PairApproval profiles={overview.profiles} pinConfigured={overview.pinConfigured}/>
   <section className="placeholder-panel kids-settings-card">
     <div className="kids-section-header">
       <span className="kids-step" aria-hidden="true">04</span>
       <h2>{t("kids.guardian.activeDevices")}</h2>
     </div>
     {overview.devices.length===0?<p className="kids-empty-state">{t("kids.guardian.noDevices")}</p>:null}
     <div className="kids-settings-list">
       {overview.devices.map(d=><div key={d.id} className="kids-settings-list-row">
         <div className="kids-profile-info">
           <strong>{d.deviceName}</strong>
           <span className="kids-profile-meta">{overview.profiles.find(p=>p.id===d.profileId)?.nickname??"—"}</span>
         </div>
         <button type="button" disabled={busy} className="btn btn-outline"
           onClick={()=>{if(window.confirm(t("kids.guardian.revokeConfirm")))
             void run({action:"device_revoke",id:d.id});}}>
           {t("kids.guardian.revoke")}
         </button>
       </div>)}
     </div>
   </section>
 </div>;
}
