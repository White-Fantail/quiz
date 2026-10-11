import { AppState } from "react-native";
import { createContext,useCallback,useContext,useEffect,useMemo,useState,type PropsWithChildren } from "react";
import { ApiError,type KidTimeState } from "@quizdip/api-client";
import { kidsApi } from "../services/api";
import { useKidsSession } from "./session";
import { useParentAccess } from "./parent";

type TimeContext={status:"checking"|"allowed"|"blocked";time:KidTimeState|null;reason:string|null;
  refresh:()=>Promise<void>};
const Context=createContext<TimeContext|null>(null);
const HEARTBEAT_MS=45000;

/** Fail closed on offline and on device clock tampering: server time is authoritative. */
export function KidsTimeProvider({children}:PropsWithChildren){
 const kid=useKidsSession(),parent=useParentAccess();
 const token=kid.status==="active"?kid.token:null;
 const [time,setTime]=useState<KidTimeState|null>(null);
 const [status,setStatus]=useState<"checking"|"allowed"|"blocked">("checking");
 const [reason,setReason]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
   if(!token||!kidsApi){setStatus("blocked");setReason("kid_session_invalid");return;}
   if(parent.access){setStatus("checking");return;}
   try{
     const next=await kidsApi.time(token,true);
     setTime(next);setReason(null);setStatus("allowed");
   }catch(e){
     setStatus("blocked");
     setReason(e instanceof ApiError?e.code:"network_unavailable");
   }
 },[token,parent.access?.token]);
 useEffect(()=>{
   if(!token){setStatus("checking");setTime(null);return;}
   void refresh();
   const timer=setInterval(()=>{if(AppState.currentState==="active")void refresh();},HEARTBEAT_MS);
   const sub=AppState.addEventListener("change",value=>{
     if(value==="active")void refresh();
     else setStatus("checking");
   });
   return ()=>{clearInterval(timer);sub.remove();};
 },[token,refresh]);
 const value=useMemo(()=>({status,time,reason,refresh}),[status,time,reason,refresh]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useKidsTime(){
 const value=useContext(Context);
 if(!value)throw new Error("Missing KidsTimeProvider");
 return value;
}
