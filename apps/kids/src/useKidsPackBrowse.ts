import {useEffect,useState} from "react";
import type {KidPackItem} from "@quizdip/api-client";
import {kidsApi} from "./services/api";
import {useKidsSession} from "./state/session";
import {useKidsTime} from "./state/time";
import {useKidsLocale} from "./state/locale";

const PAGE_SIZE=28,CACHE_MS=60_000;
type Snapshot={packs:KidPackItem[];nextOffset:number|null};
type State=Snapshot&{loading:boolean;error:boolean;loaded:boolean};
const cache=new Map<string,{until:number;value:Snapshot}>();
const pending=new Map<string,Promise<{items:KidPackItem[];hasMore:boolean}>>();
const initial:State={packs:[],nextOffset:0,loading:true,error:false,loaded:false};
function unique(previous:KidPackItem[],next:KidPackItem[]){
 const ids=new Set(previous.map(p=>p.id));
 return [...previous,...next.filter(p=>{if(ids.has(p.id))return false;ids.add(p.id);return true;})];
}
function page(token:string,offset:number){
 const key=token+":"+offset;
 const active=pending.get(key);
 if(active)return active;
 const promise=kidsApi.packs(token,offset,PAGE_SIZE).finally(()=>pending.delete(key));
 pending.set(key,promise);
 return promise;
}
/** Loads all pages so later packs and their categories are not hidden by first-page limits. */
export function useKidsPackBrowse(){
 const kid=useKidsSession(),time=useKidsTime(),{locale}=useKidsLocale();
 const token=kid.status==="active"?kid.token:null;
 const [retry,setRetry]=useState(0);
 const [state,setState]=useState<State>(initial);
 useEffect(()=>{
  let live=true;
  if(!token||time.status!=="allowed"){setState(initial);return()=>{live=false;};}
  const key=token+":"+locale;
  const cached=cache.get(key);
  const fresh=cached&&cached.until>Date.now()?cached.value:null;
  if(fresh?.nextOffset===null){
   setState({...fresh,loading:false,error:false,loaded:true});
   return()=>{live=false;};
  }
  let packs=fresh?.packs??[];
  let nextOffset=fresh?.nextOffset??0;
  setState({packs,nextOffset,loading:true,error:false,loaded:!!fresh});
  void (async()=>{
   try{
    while(live&&nextOffset!==null){
     const result=await page(token,nextOffset);
     if(!live)return;
     packs=unique(packs,result.items);
     nextOffset=result.hasMore?nextOffset+PAGE_SIZE:null;
     const value={packs,nextOffset};
     cache.set(key,{until:Date.now()+CACHE_MS,value});
     setState({...value,loading:nextOffset!==null,error:false,loaded:true});
    }
   }catch{
    if(live)setState({packs,nextOffset,loading:false,error:true,loaded:true});
   }
  })();
  return()=>{live=false;};
 },[token,locale,time.status,retry]);
 return {...state,reload:()=>{
  if(token)cache.delete(token+":"+locale);
  setRetry(x=>x+1);
 }};
}
