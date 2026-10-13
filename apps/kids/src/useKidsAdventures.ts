import {useEffect,useState} from "react";
import type {KidPackItem,KidsCatalogItem,KidsFeaturedItem} from "@quizdip/api-client";
import {kidsApi} from "./services/api";
import {useKidsSession} from "./state/session";
import {useKidsTime} from "./state/time";
import {useKidsLocale} from "./state/locale";

const PACK_BATCH=16,QUIZ_BATCH=20;
type Data={
 packs:KidPackItem[]; quizzes:KidsCatalogItem[]; featured:KidsFeaturedItem[];
 loading:boolean; error:boolean; loaded:boolean; hasMore:boolean;
};
const empty:Data={packs:[],quizzes:[],featured:[],loading:true,error:false,loaded:false,hasMore:false};
function appendUnique<T extends {id:string}>(previous:T[],incoming:T[]):T[]{
 const seen=new Set(previous.map(item=>item.id));
 return [...previous,...incoming.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;})];
}

/** All catalogue calls retain the child-only bearer, pinned language and
 * server-enforced Kids eligibility. No public/adult catalogue fallback.
 */
export function useKidsAdventures(){
 const kid=useKidsSession(),{locale}=useKidsLocale(),time=useKidsTime();
 const token=kid.status==="active"?kid.token:null;
 const [data,setData]=useState<Data>(empty);
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{setData(empty);setPage(0);},[token,locale]);
 useEffect(()=>{
  let live=true;
  if(!token||time.status!=="allowed"){setData(empty);return()=>{live=false;};}
  setData(old=>({...old,loading:true,error:false}));
  const calls=[
    kidsApi.packs(token,page*PACK_BATCH,PACK_BATCH),
    kidsApi.catalog(token,{offset:page*QUIZ_BATCH,limit:QUIZ_BATCH},locale),
    ...(page===0?[kidsApi.features(token)]:[])
  ] as const;
  void Promise.allSettled(calls).then(results=>{
   if(!live)return;
   const pack=results[0].status==="fulfilled"?results[0].value:null;
   const quiz=results[1].status==="fulfilled"?results[1].value:null;
   const featured=page===0 && results[2]?.status==="fulfilled"?results[2].value:null;
   const error=!pack||!quiz||(page===0&&!featured);
   setData(old=>({
    packs:page===0?(pack?.items||[]):appendUnique(old.packs,pack?.items||[]),
    quizzes:page===0?(quiz?.items||[]):appendUnique(old.quizzes,quiz?.items||[]),
    featured:page===0?(featured?.items||[]):old.featured,
    loading:false,error,loaded:true,
    hasMore:!!pack?.hasMore||!!quiz?.hasMore,
   }));
  });
  return()=>{live=false;};
 },[token,locale,time.status,page,retry]);
 return {...data,loadMore:()=>{if(data.hasMore&&!data.loading)setPage(p=>p+1);},
   reload:()=>setRetry(i=>i+1)};
}
