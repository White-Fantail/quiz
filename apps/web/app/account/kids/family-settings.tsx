"use client";

import { useCallback,useEffect,useState,type FormEvent } from "react";
import { useTranslation } from "../../../src/i18n/provider";

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
 const t=useTranslation();
 const [overview,setOverview]=useState<Overview|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [pin,setPin]=useState(""),[oldPin,setOldPin]=useState("");
 const [draft,setDraft]=useState<FormProfile>({...blank});
 const [editing,setEditing]=useState<string|null>(null);
 const [selected,setSelected]=useState("");
 const [pairPin,setPairPin]=useState("");
 const [ticket,setTicket]=useState<{code:string;expiresAt:string}|null>(null);
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
 const fields=<div className="family-kids-fields" style={{display:"grid",gap:"1rem",maxWidth:470}}>
   <label>{t("kids.guardian.nickname")}
     <input required maxLength={32} value={draft.nickname}
       onChange={e=>input("nickname",e.target.value)}/></label>
   <label>{t("kids.guardian.ageBand")}
     <select value={draft.ageBand} onChange={e=>input("ageBand",e.target.value)}>
       <option value="EARLY">{t("kids.guardian.early")}</option>
       <option value="MIDDLE">{t("kids.guardian.middle")}</option>
       <option value="OLDER">{t("kids.guardian.older")}</option>
     </select>
   </label>
   <label>{t("kids.guardian.language")}
     <select value={draft.locale} onChange={e=>input("locale",e.target.value)}>
       <option value="en">English</option><option value="ko">한국어</option>
     </select></label>
   <label>{t("kids.guardian.sessionLength")}
     <select value={draft.sessionMinutes} onChange={e=>input("sessionMinutes",e.target.value)}>
       <option value={0}>{t("kids.guardian.unlimited")}</option>
       {[15,30,60,120].map(v=><option key={v} value={v}>{v} {t("kids.guardian.minutes")}</option>)}
     </select>
   </label>
 </div>;
 if(loading)return <p role="status">{t("common.loading")}</p>;
 if(!overview)return <p role="alert" className="feedback">{error||t("kids.guardian.loadError")}</p>;
 return <div style={{display:"grid",gap:"1.5rem"}}>
   {error&&<p className="feedback" role="alert">{error}</p>}
   {notice&&<p className="feedback success" role="status">{notice}</p>}
   <section className="placeholder-panel">
     <h2>{t("kids.guardian.pinTitle")}</h2>
     <p className="muted">{t("kids.guardian.pinExplain")}</p>
     <form onSubmit={(e:FormEvent)=>{e.preventDefault();void run({
       action:overview.pinConfigured?"pin_change":"pin_setup",pin,
       ...(overview.pinConfigured?{previous:oldPin}:{})
     },()=>{setPin("");setOldPin("");});}}>
       <div style={{display:"grid",gap:12,maxWidth:360}}>
         {overview.pinConfigured&&<label>{t("kids.guardian.previousPin")}
           <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
             autoComplete="off" required value={oldPin} onChange={e=>setOldPin(e.target.value)}/></label>}
         <label>{overview.pinConfigured?t("kids.guardian.newPin"):t("kids.guardian.setPin")}
           <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
             autoComplete="off" required value={pin} onChange={e=>setPin(e.target.value)}/></label>
         <button className="btn btn-primary" disabled={busy||pin.length!==6}>
           {overview.pinConfigured?t("kids.guardian.changePin"):t("kids.guardian.createPin")}
         </button>
       </div>
     </form>
     {overview.pinConfigured&&<details style={{marginTop:12}}>
       <summary>{t("kids.guardian.forgotPin")}</summary>
       <p className="muted">{t("kids.guardian.resetHelp")}</p>
       <button type="button" disabled={busy||pin.length!==6} className="btn btn-outline"
         onClick={()=>void run({action:"pin_reset",pin},()=>setPin(""))}>
         {t("kids.guardian.resetPin")}
       </button>
     </details>}
   </section>
   <section className="placeholder-panel">
     <h2>{t("kids.guardian.profiles")}</h2>
     {overview.profiles.map(p=><div key={p.id}
       style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:12}}>
       <span><strong>{p.nickname}</strong> · {p.locale.toUpperCase()} · {p.ageBand}</span>
       <button type="button" className="btn btn-outline" disabled={busy}
         onClick={()=>{setEditing(p.id);setDraft({...p});}}>
         {t("kids.guardian.edit")}
       </button>
     </div>)}
     {(overview.profiles.length<8||editing)&&<form onSubmit={e=>{e.preventDefault();void run(
       editing?{action:"profile_update",id:editing,...draft}:{action:"profile_add",...draft},
       ()=>{setEditing(null);setDraft({...blank});}
     );}}>
       <h3>{editing?t("kids.guardian.edit"):t("kids.guardian.addProfile")}</h3>
       {fields}
       <div className="actions" style={{marginTop:16}}>
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
   <section className="placeholder-panel">
     <h2>{t("kids.native.pairTitle")}</h2>
     <p className="muted">{t("kids.native.pairHelp")}</p>
     <p className="muted">{t("native.pair.detail")}</p>
     <label>{t("kids.guardian.selectChild")}
       <select value={selected||overview.profiles[0]?.id||""} onChange={e=>setSelected(e.target.value)}>
         {overview.profiles.map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}
       </select></label>
     <label>{t("kids.guardian.confirmPin")}
       <input type="password" inputMode="numeric" pattern="[0-9]{6}"
         maxLength={6} autoComplete="off" value={pairPin} onChange={e=>setPairPin(e.target.value)}/>
     </label>
     <button type="button" className="btn btn-primary"
       disabled={busy||!overview.pinConfigured||!overview.profiles.length||pairPin.length!==6}
       onClick={async()=>{
         setBusy(true);setError("");setTicket(null);
         try{
           const result=await parentRequest("POST",{action:"native_pair_issue",
             profileId:selected||overview.profiles[0]?.id,pin:pairPin});
           setTicket(result);setPairPin("");
         }catch(e){setError(e instanceof Error?e.message:String(e));}
         finally{setBusy(false);}
       }}>{t("kids.native.generate")}</button>
     {ticket&&<div role="status" className="feedback" style={{marginTop:16}}>
       <p>{t("kids.native.codeLabel")}</p>
       <strong style={{fontSize:"1.35rem",letterSpacing:".04em",overflowWrap:"anywhere"}}>{ticket.code}</strong>
       <p>{t("kids.native.expires")}: {new Date(ticket.expiresAt).toLocaleTimeString()}</p>
       <p>{t("kids.native.oneTime")}</p>
     </div>}
   </section>
   <section className="placeholder-panel">
     <h2>{t("kids.guardian.activeDevices")}</h2>
     {overview.devices.length===0?<p className="muted">{t("kids.guardian.noDevices")}</p>:null}
     {overview.devices.map(d=><div key={d.id}
       style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap",marginTop:12}}>
       <span>{d.deviceName} · {overview.profiles.find(p=>p.id===d.profileId)?.nickname??"—"}</span>
       <button type="button" disabled={busy} className="btn btn-outline"
         onClick={()=>{if(window.confirm(t("kids.guardian.revokeConfirm")))
           void run({action:"device_revoke",id:d.id});}}>
         {t("kids.guardian.revoke")}
       </button>
     </div>)}
   </section>
 </div>;
}
