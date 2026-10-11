import { AppState } from "react-native";
import { createContext,useCallback,useContext,useEffect,useMemo,useState,type PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import { ApiError,type NativeKidSession } from "@quizdip/api-client";
import { kidsApi } from "../services/api";

const STORAGE_KEY="quizdip-kids-native-device-v1";
type SessionState =
 | {status:"checking"|"unpaired"|"unavailable";token?:never;session?:never}
 | {status:"active";token:string;session:NativeKidSession};
type SessionContextValue = SessionState & {
  reload:()=>Promise<void>;
  pair:(code:string,deviceName:string)=>Promise<void>;
  unlock:(pin:string)=>Promise<void>;
};
const Context=createContext<SessionContextValue|null>(null);

/** Tokens persist only in OS secure storage, never in AsyncStorage or Expo public configuration. */
export function KidsSessionProvider({children}:PropsWithChildren){
 const [state,setState]=useState<SessionState>({status:"checking"});
 const reload=useCallback(async()=>{
   setState({status:"checking"});
   try {
     const token=await SecureStore.getItemAsync(STORAGE_KEY);
     if(!token){setState({status:"unpaired"});return;}
     if(!kidsApi){setState({status:"unavailable"});return;}
     try {
       const session=await kidsApi.session(token);
       setState({status:"active",token,session});
     }catch(e){
       if(e instanceof ApiError && [401,403].includes(e.status??0)){
         await SecureStore.deleteItemAsync(STORAGE_KEY);
         setState({status:"unpaired"});
       }else setState({status:"unavailable"});
     }
   }catch {setState({status:"unavailable"});}
 },[]);
 useEffect(()=>{
   void reload();
   const sub=AppState.addEventListener("change",value=>{if(value==="active")void reload();});
   return ()=>sub.remove();
 },[reload]);
 const pair=useCallback(async(code:string,deviceName:string)=>{
   if(!kidsApi)throw new ApiError("missing_api_origin");
   setState({status:"checking"});
   try {
     const result=await kidsApi.pair(code,deviceName);
     await SecureStore.setItemAsync(STORAGE_KEY,result.token,{
       keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
     });
     setState({status:"active",token:result.token,session:{
       active:true,profile:result.profile,expiresAt:result.expiresAt
     }});
   }catch(e){
     setState({status:"unpaired"});
     throw e;
   }
 },[]);
 const unlock=useCallback(async(pin:string)=>{
   if(state.status!=="active"||!kidsApi)throw new ApiError("native_session_invalid",401);
   await kidsApi.unlock(state.token,pin);
   await SecureStore.deleteItemAsync(STORAGE_KEY);
   setState({status:"unpaired"});
 },[state]);
 const value=useMemo<SessionContextValue>(()=>({...state,reload,pair,unlock}),[state,reload,pair,unlock]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useKidsSession():SessionContextValue {
 const value=useContext(Context);
 if(!value)throw new Error("Missing KidsSessionProvider");
 return value;
}
