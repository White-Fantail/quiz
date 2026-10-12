"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "../../../src/i18n/provider";
import { localizeHref } from "../../../src/i18n/core";

type Profile={id:string;nickname:string};
type Props={qrToken?:string;profiles?:Profile[];pinConfigured?:boolean};

export default function PairApproval({qrToken,profiles:initialProfiles,pinConfigured:initialPin}:Props){
 const locale=useLocale(),ko=locale==="ko";
 const [profiles,setProfiles]=useState<Profile[]>(initialProfiles??[]);
 const [pinConfigured,setPinConfigured]=useState(initialPin??false);
 const [selected,setSelected]=useState(initialProfiles?.[0]?.id??"");
 const [pin,setPin]=useState("");
 const [code,setCode]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [pairedDevice,setPairedDevice]=useState("");
 useEffect(()=>{
   if(initialProfiles)return;
   let cancelled=false;
   void fetch("/api/account/kids",{credentials:"same-origin",cache:"no-store"})
     .then(async res=>{
       const body=await res.json();
       if(!res.ok)throw new Error(body?.message??"Could not load profiles");
       if(!cancelled){
         setProfiles(body.data.profiles);setPinConfigured(body.data.pinConfigured);
         setSelected(body.data.profiles[0]?.id??"");
       }
     })
     .catch(e=>{if(!cancelled)setError(String(e));});
   return ()=>{cancelled=true;};
 },[initialProfiles]);
 const approve=async(e:FormEvent)=>{
   e.preventDefault();
   if(busy)return;
   setBusy(true);setError("");setPairedDevice("");
   try{
     const res=await fetch("/api/account/kids",{
       method:"POST",credentials:"same-origin",cache:"no-store",
       headers:{"Content-Type":"application/json"},
       body:JSON.stringify({action:"native_pair_approve",profileId:selected,pin,
         ...(qrToken?{qrToken}:{shortCode:code.replace(/\s/g,"")})})
     });
     const body=await res.json();
     if(!res.ok)throw new Error(body?.message??body?.error??"Could not approve pairing");
     setPairedDevice(body.data.deviceName);setPin("");setCode("");
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
 };
 if(pairedDevice)return <section className="placeholder-panel kids-settings-card kids-pair-success" role="status">
   <h2>{ko?"연결을 승인했어요!":"Connection approved!"}</h2>
   <p>{ko?pairedDevice+"에서 자동으로 시작됩니다.":pairedDevice+" will start automatically."}</p>
   <Link className="btn btn-outline" href={localizeHref("/account/kids",locale)}>
     {ko?"키즈 설정으로 돌아가기":"Back to Kids settings"}</Link>
 </section>;
 return <section className="placeholder-panel kids-settings-card">
   <div className="kids-section-header">
     <span className="kids-step" aria-hidden="true">03</span>
     <div>
       <h2>{ko?"아이 기기 연결":"Connect a child's device"}</h2>
       <p className="muted">{qrToken
     ? (ko?"아이패드의 연결 요청을 승인해 주세요.":"Approve the connection request from the child's iPad.")
     : (ko?"아이패드에서 QR 코드를 스캔하거나, 아래에 6자리 코드를 입력하세요.":"Scan the QR shown on the child's iPad, or enter its six-digit code below.")}</p>
     </div>
   </div>
   {!pinConfigured||profiles.length===0?<p role="alert">
     {ko?"먼저 자녀 프로필과 보호자 PIN을 설정해 주세요.":"Set up a child profile and parent PIN first."}
     {" "}<Link href={localizeHref("/account/kids",locale)}>{ko?"키즈 설정":"Kids settings"}</Link>
   </p>:
   <form className="kids-settings-form kids-pair-form" onSubmit={approve}>
     {!qrToken&&<label className="kids-form-field">{ko?"아이패드에 표시된 6자리 코드":"Six-digit code shown on the iPad"}
       <input type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code"
         placeholder="123456" maxLength={6} required value={code}
         onChange={e=>setCode(e.target.value.replace(/\D/g,""))}
         className="kids-pair-code"/>
     </label>}
     <label className="kids-form-field">{ko?"연결할 자녀":"Select child"}
       <select value={selected} required onChange={e=>setSelected(e.target.value)}>
         {profiles.map(p=><option key={p.id} value={p.id}>{p.nickname}</option>)}
       </select>
     </label>
     <label className="kids-form-field">{ko?"보호자 PIN":"Parent PIN"}
       <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
         autoComplete="off" required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/>
     </label>
     <button className="btn btn-primary" disabled={busy||pin.length!==6||!selected||(!qrToken&&code.length!==6)}>
       {busy?(ko?"연결하는 중…":"Connecting…"):(ko?"이 기기 연결 승인":"Approve device connection")}
     </button>
   </form>}
   {error?<p role="alert" className="feedback">{error}</p>:null}
   <p className="kids-pair-footnote">
     {ko?"QR과 숫자 코드는 5분 뒤 만료되며 한 번만 사용할 수 있어요.":"QR and numeric codes expire after five minutes and can be used only once."}
   </p>
 </section>;
}
