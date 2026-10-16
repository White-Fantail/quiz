"use client";
import Script from "next/script";
import {createContext,useCallback,useContext,useMemo,useState} from "react";
import type {AdsConfig} from "../../lib/ads/config";

type ScriptState="idle"|"loading"|"ready"|"failed";
const AdsContext=createContext<{
  config:AdsConfig;scriptState:ScriptState;requestScript:()=>void;
}|null>(null);

/** One script per document, requested only by visible eligible manual slots. */
export function AdProvider({config,children}:{config:AdsConfig;children:React.ReactNode}){
  const [requested,setRequested]=useState(false);
  const [scriptState,setScriptState]=useState<ScriptState>("idle");
  const requestScript=useCallback(()=>{
    if(!config.enabled)return;
    setRequested(true);
    setScriptState(current=>current==="idle"?"loading":current);
  },[config.enabled]);
  const value=useMemo(()=>({config,scriptState,requestScript}),[config,scriptState,requestScript]);
  return <AdsContext.Provider value={value}>
    {children}
    {config.enabled&&requested&&<Script id="quizdip-adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.publisherId)}`}
      strategy="afterInteractive" crossOrigin="anonymous"
      onReady={()=>setScriptState("ready")} onError={()=>setScriptState("failed")}/>}
  </AdsContext.Provider>;
}
export function useAds(){
  const value=useContext(AdsContext);
  if(!value)throw new Error("AdSlot requires AdProvider");
  return value;
}
