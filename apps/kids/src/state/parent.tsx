import { AppState } from "react-native";
import { createContext,useCallback,useContext,useEffect,useMemo,useState,type PropsWithChildren } from "react";
import { ApiError } from "@quizdip/api-client";
import { parentApi } from "../services/api";
import { useKidsSession } from "./session";

type Access={token:string;expiresAt:number}|null;
type Context={access:Access;authorize:(pin:string)=>Promise<void>;clear:()=>void;
  revoke:()=>Promise<void>;verifiedToken:()=>string};
const ParentContext=createContext<Context|null>(null);
export function KidsParentProvider({children}:PropsWithChildren){
 const kid=useKidsSession();
 const [access,setAccess]=useState<Access>(null);
 const clear=useCallback(()=>setAccess(null),[]);
 useEffect(()=>{
   const sub=AppState.addEventListener("change",s=>{if(s!=="active")clear();});
   return ()=>sub.remove();
 },[clear]);
 useEffect(()=>{if(kid.status!=="active")clear();},[kid.status,clear]);
 const authorize=useCallback(async(pin:string)=>{
   if(kid.status!=="active"||!parentApi)throw new ApiError("native_session_invalid",401);
   const data=await parentApi.authorize(kid.token,pin);
   setAccess({token:data.parentToken,expiresAt:Date.parse(data.expiresAt)});
 },[kid.status,kid.status==="active"?kid.token:""]);
 const verifiedToken=useCallback(()=>{
   if(!access||access.expiresAt<=Date.now()){
     clear();throw new ApiError("parent_session_expired",401);
   }
   return access.token;
 },[access,clear]);
 const revoke=useCallback(async()=>{
   if(kid.status==="active"&&access&&parentApi&&access.expiresAt>Date.now()){
     try{await parentApi.action(kid.token,access.token,{action:"logout"});}catch{/* Expiry is safe. */}
   }
   clear();
 },[kid.status,kid.status==="active"?kid.token:"",access,clear]);
 const value=useMemo(()=>({access,authorize,clear,revoke,verifiedToken}),[access,authorize,clear,revoke,verifiedToken]);
 return <ParentContext.Provider value={value}>{children}</ParentContext.Provider>;
}
export function useParentAccess(){
 const value=useContext(ParentContext);
 if(!value)throw new Error("Missing KidsParentProvider");
 return value;
}
