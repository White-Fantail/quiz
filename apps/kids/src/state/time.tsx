import { AppState } from "react-native";
import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import { localChildDay } from "@quizdip/domain";
import { type KidTimeState } from "@quizdip/api-client";
import { kidsApi } from "../services/api";
import { useKidsSession } from "./session";
import { useParentAccess } from "./parent";

type TimeContext={status:"checking"|"allowed"|"blocked";time:KidTimeState|null;reason:string|null;
  refresh:()=>Promise<void>};
const Context=createContext<TimeContext|null>(null);
const STORAGE="quizdip-kids-local-time-v1";
type Saved={token:string;state:KidTimeState;at:number};

/** Play budget is advisory and local. Server is queried only for settings refresh. */
export function KidsTimeProvider({children}:PropsWithChildren){
 const kid=useKidsSession(),parent=useParentAccess();
 const token=kid.status==="active"?kid.token:null;
 const [time,setTime]=useState<KidTimeState|null>(null);
 const [status,setStatus]=useState<"checking"|"allowed"|"blocked">("checking");
 const [reason,setReason]=useState<string|null>(null);
 const stateRef=useRef<KidTimeState|null>(null);
 const activeFrom=useRef<number|null>(null);
 const countedActiveMs=useRef(0);
 const nowUsed=()=>{
   const p=stateRef.current;
   if(!p)return null;
   const current=Date.now();
   const today=localChildDay(new Date(current),p.limits.timeZone);
   const extra=Math.floor((countedActiveMs.current+
      (activeFrom.current===null?0:current-activeFrom.current))/60000);
   const rollover=today!==p.localDay;
   const used=(rollover?0:p.usedMinutes)+extra;
   const sessionMinutesUsed=p.sessionMinutesUsed+extra;
   return {...p,localDay:today,usedMinutes:used,sessionMinutesUsed,
     remainingMinutes:p.limits.dailyMinutes===0?null:Math.max(0,p.limits.dailyMinutes-used),
     limitReached:p.limits.dailyMinutes>0&&used>=p.limits.dailyMinutes};
 };
 const apply=useCallback((state:KidTimeState)=>{
   stateRef.current=state;
   countedActiveMs.current=0;
   activeFrom.current=AppState.currentState==="active"?Date.now():null;
   setTime(state);setReason(null);
   setStatus("allowed");
 },[]);
 const refresh=useCallback(async()=>{
   if(!token||!kidsApi){setStatus("checking");return;}
   if(parent.access){return;}
   try{
     const next=await kidsApi.time(token,false);
     const cached=JSON.parse(await SecureStore.getItemAsync(STORAGE)||"null") as Saved|null;
     const sameDay=cached?.token===token&&
       cached.state?.localDay===localChildDay(new Date(),next.limits.timeZone);
     const usedMinutes=sameDay?cached.state.usedMinutes:0;
     const sessionMinutesUsed=sameDay?cached.state.sessionMinutesUsed:0;
     const local={...next,blockedUntil:sameDay?cached.state.blockedUntil:null,
       usedMinutes,sessionMinutesUsed,
       remainingMinutes:next.limits.dailyMinutes===0?null:Math.max(0,next.limits.dailyMinutes-usedMinutes),
       limitReached:next.limits.dailyMinutes>0&&usedMinutes>=next.limits.dailyMinutes};
     apply(local);
     await SecureStore.setItemAsync(STORAGE,JSON.stringify({token,state:local,at:Date.now()} satisfies Saved));
   }catch{
     try{
       const cached=JSON.parse(await SecureStore.getItemAsync(STORAGE)||"null") as Saved|null;
       if(cached?.token===token&&cached.state?.limits){
         // Resume the local budget without requiring a live heartbeat.
         apply(cached.state);return;
       }
     }catch{}
     setStatus("checking");setReason("network_unavailable");
   }
 },[token,parent.access?.token,apply]);
 useEffect(()=>{if(token)void refresh();else{setTime(null);stateRef.current=null;}},[token,refresh]);
 useEffect(()=>{
   const pulse=()=>{
     if(!stateRef.current)return;
     const next=nowUsed();
     if(!next)return;
     setTime(next);
     if(next.limitReached||(next.limits.playSessionMinutes>0&&
        next.sessionMinutesUsed>=next.limits.playSessionMinutes)){
       setStatus("blocked");setReason(next.limitReached?"kid_daily_limit":"kid_session_limit");
     }else{setStatus("allowed");setReason(null);}
     if(token){
       const snap=next;
       void SecureStore.setItemAsync(STORAGE,JSON.stringify({token,state:snap,at:Date.now()} satisfies Saved)).catch(()=>{});
     }
   };
   const timer=setInterval(pulse,15000);
   const sub=AppState.addEventListener("change",value=>{
     if(value==="active"){activeFrom.current=Date.now();pulse();}
     else if(activeFrom.current!==null){
       countedActiveMs.current+=Date.now()-activeFrom.current;
       activeFrom.current=null;pulse();
     }
   });
   return ()=>{clearInterval(timer);sub.remove();};
 },[token]);
 const value=useMemo(()=>({status,time,reason,refresh}),[status,time,reason,refresh]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useKidsTime(){
 const value=useContext(Context);
 if(!value)throw new Error("Missing KidsTimeProvider");
 return value;
}
