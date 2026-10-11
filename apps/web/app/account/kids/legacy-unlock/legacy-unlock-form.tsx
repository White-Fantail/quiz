"use client";
import { useState,type FormEvent } from "react";
import { useLocale } from "../../../../src/i18n/provider";
export default function LegacyUnlockForm(){
 const locale=useLocale(),[pin,setPin]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(event:FormEvent){
   event.preventDefault();if(busy)return;
   setBusy(true);setError("");
   try{
     const response=await fetch("/api/account/kids/legacy-unlock",{
       method:"POST",credentials:"same-origin",cache:"no-store",
       headers:{"Content-Type":"application/json"},
       body:JSON.stringify({pin})
     });
     const result=await response.json().catch(()=>null);
     if(!response.ok)throw new Error(result?.error||"unknown_error");
     window.location.replace((locale==="ko"?"/ko":"/en")+"/account/kids");
   }catch(e){
     const code=e instanceof Error?e.message:"unknown_error";
     setError(code==="kid_pin_locked"?
       (locale==="ko"?"PIN 입력 횟수가 너무 많아요. 잠시 후 다시 시도하세요.":"Too many PIN attempts. Please try later."):
       (locale==="ko"?"PIN을 확인하지 못했어요. 보호자에게 도움을 요청하세요.":"PIN could not be verified. Ask a parent for help."));
   }finally{setBusy(false);}
 }
 return <form onSubmit={e=>void submit(e)} style={{display:"grid",gap:12,maxWidth:370}}>
   <label>{locale==="ko"?"보호자 PIN (6자리)":"Guardian PIN (6 digits)"}
     <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
       autoComplete="off" required value={pin} onChange={e=>setPin(e.target.value)}/>
   </label>
   <button type="submit" className="btn btn-primary" disabled={busy||pin.length!==6}>
     {locale==="ko"?"보호자 잠금 해제":"Unlock with parent PIN"}
   </button>
   {error?<p role="alert" className="feedback">{error}</p>:null}
   <p className="muted">{locale==="ko"?
     "연결한 보호자 PIN을 잊었거나 이전 기기 기록을 삭제했다면, 다른 기기의 QuizDip 내 계정에서 PIN을 재설정하고 이 브라우저의 저장된 사이트 데이터를 정리해 주세요.":
     "If the parent PIN or old device record is unavailable, use a different browser to reset the PIN in your QuizDip account, then clear this browser's old site data."}</p>
 </form>;
}
