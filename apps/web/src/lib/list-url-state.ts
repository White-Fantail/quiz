"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep list navigation in the URL rather than in a component that unmounts
 * when the user opens a detail page. replaceState avoids creating one browser
 * history entry per typed character; browser Back still returns to this URL.
 * Each list owns only its named query keys, preserving unrelated parameters.
 */
export function useListUrlState<T extends Record<string,string>>(defaults:T) {
  const initial=useRef(defaults);
  const [values,setValues]=useState<T>(defaults);
  const latest=useRef<T>(defaults);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const read=()=>{
      const params=new URLSearchParams(window.location.search);
      const next={...initial.current} as T;
      for(const key of Object.keys(next)){
        const value=params.get(key);
        if(value!==null)next[key as keyof T]=value as T[keyof T];
      }
      latest.current=next;
      setValues(next);
      setReady(true);
    };
    read();
    window.addEventListener("popstate",read);
    return ()=>window.removeEventListener("popstate",read);
  },[]);

  const update=useCallback((changes:Partial<T>)=>{
    const next={...latest.current,...changes} as T;
    latest.current=next;
    setValues(next);
    const url=new URL(window.location.href);
    for(const key of Object.keys(initial.current)){
      if(!next[key]||next[key]===initial.current[key])url.searchParams.delete(key);
      else url.searchParams.set(key,next[key]);
    }
    window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  },[]);

  return [values,update,ready] as const;
}

/** URL page numbers are one-based and intentionally bounded. */
export function listPageIndex(value:string,max=10000){
  if(!/^\d+$/.test(value))return 0;
  const number=Number(value);
  return Number.isSafeInteger(number)?Math.max(0,Math.min(max,number-1)):0;
}

export function listHref(base:string,values:Record<string,string>,defaults:Record<string,string>){
  const query=new URLSearchParams();
  for(const key of Object.keys(defaults)){
    if(values[key]&&values[key]!==defaults[key])query.set(key,values[key]);
  }
  return base+(query.size?"?"+query.toString():"");
}

export function listBackHref(base:string,params:Record<string,string|string[]|undefined>,keys:readonly string[]){
  const query=new URLSearchParams();
  for(const key of keys){
    const value=params[key];
    if(typeof value==="string"&&value.length<=200)query.set(key,value);
  }
  return base+(query.size?"?"+query.toString():"");
}
