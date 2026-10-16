"use client";
import {useEffect,useRef,useState} from "react";
import {canShowAd,type AdPlacement} from "../../lib/ads/config";
import {useAds} from "./AdProvider";

declare global{
  interface Window{adsbygoogle?:{push:(value:Record<string,never>)=>number}}
}
export default function AdSlot({placement,kids=false,fullRow=false}:{placement:AdPlacement;kids?:boolean;fullRow?:boolean}){
  const {config,scriptState,requestScript}=useAds();
  const allowed=canShowAd(config,placement,kids);
  const hostRef=useRef<HTMLElement>(null);
  const insRef=useRef<HTMLModElement>(null);
  const [near,setNear]=useState(false);
  useEffect(()=>{
    if(!allowed||!hostRef.current)return;
    if(typeof IntersectionObserver==="undefined"){setNear(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(item=>item.isIntersecting)){setNear(true);observer.disconnect();}
    },{rootMargin:"300px 0px"});
    observer.observe(hostRef.current);
    return ()=>observer.disconnect();
  },[allowed]);
  useEffect(()=>{if(allowed&&near)requestScript();},[allowed,near,requestScript]);
  useEffect(()=>{
    if(!allowed||!near||scriptState!=="ready"||!insRef.current)return;
    const node=insRef.current;
    if(node.dataset.quizdipAdInitialized==="true")return;
    node.dataset.quizdipAdInitialized="true";
    try{
      window.adsbygoogle=window.adsbygoogle||[];
      window.adsbygoogle.push({});
    }catch{
      // An ad blocker must never break the quiz, results, or navigation.
      node.dataset.quizdipAdFailed="true";
    }
  },[allowed,near,scriptState]);
  if(!allowed)return null;
  return <aside ref={hostRef} className={fullRow?"quizdip-ad-slot discover-ad-row":"quizdip-ad-slot"} aria-label="Advertisement"
    data-ad-placement={placement}>
    <span className="quizdip-ad-label">Advertisement</span>
    <ins ref={insRef} className="adsbygoogle quizdip-ad-ins"
      data-ad-client={config.publisherId} data-ad-slot={config.slots[placement]}
      data-ad-format="horizontal" data-full-width-responsive="true"/>
  </aside>;
}
