import {useEffect,useState} from "react";
import type {KidPackItem,KidsCatalogItem,KidsFeaturedItem} from "@quizdip/api-client";
import {kidsApi} from "./services/api";
import {useKidsSession} from "./state/session";
import {useKidsTime} from "./state/time";
import {useKidsLocale} from "./state/locale";

const PACK_BATCH=16,QUIZ_BATCH=20, CACHE_MS=60_000;
type Data={
 packs:KidPackItem[]; quizzes:KidsCatalogItem[]; featured:KidsFeaturedItem[];
 loading:boolean; error:boolean; loaded:boolean; hasMore:boolean;
};
const empty:Data={packs:[],quizzes:[],featured:[],loading:true,error:false,loaded:false,hasMore:false};
const initialCache=new Map<string,{until:number;data:Data}>();
const inFlight=new Map<string,Promise<Data>>();

function keyFor(token:string,locale:string){return token+":"+locale;}
function cached(key:string):Data|null {
 const value=initialCache.get(key);
 if(!value)return null;
 if(Date.now()>value.until){initialCache.delete(key);return null;}
 return value.data;
}
function loadInitial(token:string,locale:string,force:boolean):Promise<Data>{
 const key=keyFor(token,locale);
 // Multiple tabs share one child-scoped request and do not fetch again on navigation.
 if(!force){const hit=cached(key);if(hit)return Promise.resolve(hit);}
 const running=inFlight.get(key);
 if(running)return running;
 const request=Promise.allSettled([
   kidsApi.packs(token,0,PACK_BATCH),
   kidsApi.catalog(token,{offset:0,limit:QUIZ_BATCH},locale),
   kidsApi.features(token),
 ]).then(results=>{
   const packs=results[0].status==="fulfilled"?results[0].value:null;
   const quizzes=results[1].status==="fulfilled"?results[1].value:null;
   const featured=results[2].status==="fulfilled"?results[2].value:null;
   const error=!packs||!quizzes||!featured;
   const data:Data={
     packs:packs?.items||[],quizzes:quizzes?.items||[],featured:featured?.items||[],
     loading:false,error,loaded:true,hasMore:!!packs?.hasMore||!!quizzes?.hasMore,
   };
   if(!error){
     if(initialCache.size>=5)initialCache.clear();
     initialCache.set(key,{until:Date.now()+CACHE_MS,data});
   }
   return data;
 }).finally(()=>inFlight.delete(key));
 inFlight.set(key,request);
 return request;
}
function appendUnique<T extends {id:string}>(previous:T[],incoming:T[]):T[]{
 const seen=new Set(previous.map(item=>item.id));
 return [...previous,...incoming.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;})];
}

/** In-memory-only, short-lived child-token-scoped cache. Never fall back to adult data. */
export function useKidsAdventures(){
 const kid=useKidsSession(),{locale}=useKidsLocale(),time=useKidsTime();
 const token=kid.status==="active"?kid.token:null;
 const cacheKey=token?keyFor(token,locale):null;
 const [data,setData]=useState<Data>(()=>cacheKey?cached(cacheKey)||empty:empty);
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{
   setData(cacheKey?cached(cacheKey)||empty:empty);
   setPage(0);
 },[cacheKey]);
 useEffect(()=>{
  let live=true;
  if(!token||time.status!=="allowed"){setData(empty);return()=>{live=false;};}
  if(page===0){
   if(retry===0){
     const hit=cached(keyFor(token,locale));
     if(hit){setData(hit);return()=>{live=false;};}
   }
   setData(old=>({...old,loading:true,error:false}));
   void loadInitial(token,locale,retry>0).then(fresh=>{
     if(live)setData(fresh);
   });
  }else{
   setData(old=>({...old,loading:true,error:false}));
   void Promise.allSettled([
     kidsApi.packs(token,page*PACK_BATCH,PACK_BATCH),
     kidsApi.catalog(token,{offset:page*QUIZ_BATCH,limit:QUIZ_BATCH},locale),
   ]).then(results=>{
     if(!live)return;
     const pack=results[0].status==="fulfilled"?results[0].value:null;
     const quiz=results[1].status==="fulfilled"?results[1].value:null;
     setData(old=>({
       packs:appendUnique(old.packs,pack?.items||[]),
       quizzes:appendUnique(old.quizzes,quiz?.items||[]),
       featured:old.featured,
       loading:false,error:!pack||!quiz,loaded:true,
       hasMore:!!pack?.hasMore||!!quiz?.hasMore,
     }));
   });
  }
  return()=>{live=false;};
 },[token,locale,time.status,page,retry]);
 return {...data,
  loadMore:()=>{if(data.hasMore&&!data.loading)setPage(p=>p+1);},
  reload:()=>{
    if(cacheKey)initialCache.delete(cacheKey);
    setPage(0);setRetry(i=>i+1);
  },
 };
}
