import {useCallback,useRef} from "react";
import {useFocusEffect,useRouter,type Href} from "expo-router";

/** Ignore consecutive taps while Expo Router is transitioning screens. */
export function useKidsNavigation(){
 const router=useRouter();
 const navigating=useRef(false);
 useFocusEffect(useCallback(()=>{
   navigating.current=false;
   return ()=>{navigating.current=false;};
 },[]));
 return useCallback((href:Href)=>{
   if(navigating.current)return;
   navigating.current=true;
   router.push(href);
 },[router]);
}
