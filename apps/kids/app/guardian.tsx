import { useCallback,useEffect,useState } from "react";
import { Alert,ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View } from "react-native";
import { Redirect,useRouter } from "expo-router";
import { ApiError,type GuardianDashboard,type GuardianChildProfile } from "@quizdip/api-client";
import { Screen,Banner } from "../src/components/Screen";
import { useKidsSession } from "../src/state/session";
import { useParentAccess } from "../src/state/parent";
import { useKidsLocale } from "../src/state/locale";
import { parentApi } from "../src/services/api";
import { theme } from "../src/theme";

type Choice<T extends string|number>={value:T;label:string};
const ages:Choice<GuardianChildProfile["ageBand"]>[]=[
 {value:"EARLY",label:"5–7"},{value:"MIDDLE",label:"8–10"},{value:"OLDER",label:"11+"}
];
const locales:Choice<"en"|"ko">[]=[{value:"en",label:"English"},{value:"ko",label:"한국어"}];
const limits=[0,15,30,45,60,90,120] as const;
const sessions=[0,10,15,20,30,45,60] as const;
const breaks=[0,15,20,30] as const;
type Editable=Omit<GuardianChildProfile,"id">;
const defaults:Editable={nickname:"",ageBand:"MIDDLE",locale:"en",sessionMinutes:0,
 dailyMinutes:30,playSessionMinutes:20,breakEveryMinutes:20,timeZone:"Pacific/Auckland"};
function ChoiceRow<T extends string|number>({values,value,onChange}:{
 values:Choice<T>[];value:T;onChange:(v:T)=>void
}){
 return <View style={styles.options}>
   {values.map(opt=><Pressable key={String(opt.value)} accessibilityRole="button"
    accessibilityState={{selected:value===opt.value}}
    onPress={()=>onChange(opt.value)} style={[styles.choice,value===opt.value&&styles.chosen]}>
     <Text style={[styles.choiceText,value===opt.value&&styles.chosenText]}>{opt.label}</Text>
   </Pressable>)}
 </View>;
}
export default function GuardianDashboardScreen(){
 const router=useRouter(),kid=useKidsSession(),parent=useParentAccess(),{t}=useKidsLocale();
 const [data,setData]=useState<GuardianDashboard|null>(null);
 const [selected,setSelected]=useState<string>("new");
 const [draft,setDraft]=useState<Editable>(defaults);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [pairPin,setPairPin]=useState(""),[pairCode,setPairCode]=useState("");
 const [previousPin,setPreviousPin]=useState(""),[newPin,setNewPin]=useState("");
 const token=kid.status==="active"?kid.token:null;
 const access=parent.access;
 const load=useCallback(async()=>{
   if(!token||!access||!parentApi)return;
   try{const info=await parentApi.dashboard(token,parent.verifiedToken());
     setData(info);setError("");
   }catch(e){
     if(e instanceof ApiError && [401,403].includes(e.status??0)){parent.clear();return;}
     setError(t("native.parent.error"));
   }
 },[token,access?.token,parent.verifiedToken,parent.clear,t]);
 useEffect(()=>{void load();},[load]);
 const select=(id:string)=>{
   setSelected(id);setPairCode("");setNotice("");
   const existing=data?.profiles.find(p=>p.id===id);
   setDraft(existing?{nickname:existing.nickname,ageBand:existing.ageBand,locale:existing.locale,
     sessionMinutes:existing.sessionMinutes,dailyMinutes:existing.dailyMinutes,
     playSessionMinutes:existing.playSessionMinutes,breakEveryMinutes:existing.breakEveryMinutes,
     timeZone:existing.timeZone}:{...defaults});
 };
 const perform=async(action:Record<string,unknown>,label:string,reset=false):Promise<boolean>=>{
   if(!token||!parentApi||busy)return false;
   setBusy(true);setError("");setNotice("");
   try{
     await parentApi.action(token,parent.verifiedToken(),action);
     setNotice(label);
     if(reset){setSelected("new");setDraft({...defaults});}
     await load();
     return true;
   }catch(e){
     if(e instanceof ApiError&&e.code==="parent_session_expired"){parent.clear();return false;}
     setError(e instanceof ApiError?e.code:t("native.parent.error"));
     return false;
   }finally{setBusy(false);}
 };
 const confirm=(title:string,action:Record<string,unknown>,reset=false)=>{
   Alert.alert(title,t("native.parent.confirmBody"),[
     {text:t("kids.guardian.cancel"),style:"cancel"},
     {text:t("native.parent.confirm"),style:"destructive",
       onPress:()=>void perform(action,t("native.parent.saved"),reset)}
   ]);
 };
 if(kid.status!=="active")return <Redirect href="/setup"/>;
 if(!access||access.expiresAt<=Date.now())return <Redirect href="/parent"/>;
 const selectedProfile=data?.profiles.find(p=>p.id===selected);
 const insight=data?.insights.find(x=>x.profileId===selected);
 const devices=(data?.devices??[]).filter(d=>d.profileId===selected);
 const setField=<K extends keyof Editable>(key:K,value:Editable[K])=>setDraft(v=>({...v,[key]:value}));
 const limitOptions=(values:readonly number[]):Choice<number>[]=>values.map(v=>({value:v,label:v===0?t("native.parent.unlimited"):v+"m"}));
 return <Screen title={t("native.parent.title")} subtitle={t("native.parent.subtitle")}>
   <Banner emoji="👨‍👩‍👧" title={t("native.parent.title")} detail={t("native.parent.private")} tint={theme.colors.mint}/>
   {!data?<ActivityIndicator color={theme.colors.accent}/>:<>
     <Text style={styles.heading}>{t("native.parent.children")}</Text>
     <View style={styles.options}>
       {data.profiles.map(p=><Pressable key={p.id} accessibilityRole="button"
         accessibilityState={{selected:selected===p.id}} onPress={()=>select(p.id)}
         style={[styles.choice,selected===p.id&&styles.chosen]}>
           <Text style={[styles.choiceText,selected===p.id&&styles.chosenText]}>🧒 {p.nickname}</Text>
       </Pressable>)}
       {data.profiles.length<8?<Pressable accessibilityRole="button" onPress={()=>select("new")}
         style={[styles.choice,selected==="new"&&styles.chosen]}>
         <Text style={[styles.choiceText,selected==="new"&&styles.chosenText]}>＋ {t("native.parent.add")}</Text>
       </Pressable>:null}
     </View>
     <View style={styles.panel}>
       <Text style={styles.heading}>{selectedProfile?t("native.parent.edit"):t("native.parent.add")}</Text>
       <Text style={styles.label}>{t("native.parent.nickname")}</Text>
       <TextInput style={styles.input} value={draft.nickname} onChangeText={v=>setField("nickname",v)}
         maxLength={32} accessibilityLabel={t("native.parent.nickname")}/>
       <Text style={styles.label}>{t("native.parent.age")}</Text>
       <ChoiceRow values={ages} value={draft.ageBand} onChange={v=>setField("ageBand",v)}/>
       <Text style={styles.label}>{t("native.parent.language")}</Text>
       <ChoiceRow values={locales} value={draft.locale} onChange={v=>setField("locale",v)}/>
       <Text style={styles.label}>{t("native.parent.daily")}</Text>
       <ChoiceRow values={limitOptions(limits)} value={draft.dailyMinutes} onChange={v=>setField("dailyMinutes",v)}/>
       <Text style={styles.label}>{t("native.parent.session")}</Text>
       <ChoiceRow values={limitOptions(sessions)} value={draft.playSessionMinutes} onChange={v=>setField("playSessionMinutes",v)}/>
       <Text style={styles.label}>{t("native.parent.break")}</Text>
       <ChoiceRow values={limitOptions(breaks)} value={draft.breakEveryMinutes} onChange={v=>setField("breakEveryMinutes",v)}/>
       <Text style={styles.label}>{t("native.parent.timezone")}</Text>
       <ChoiceRow values={data.availableTimeZones.map(zone=>({value:zone,label:zone.replaceAll("_"," ")}))}
         value={draft.timeZone} onChange={v=>setField("timeZone",v)}/>
       <Text style={styles.note}>{t("native.parent.localeWarning")}</Text>
       <Pressable accessibilityRole="button" disabled={busy||!draft.nickname.trim()} style={[styles.button,busy&&styles.disabled]}
         onPress={()=>void perform(selectedProfile?
           {action:"profile_update",id:selectedProfile.id,profile:draft}:{action:"profile_add",profile:draft},
           t("native.parent.saved"))}>
         <Text style={styles.buttonText}>{t("native.parent.save")}</Text>
       </Pressable>
       {selectedProfile?<View style={styles.actions}>
         <Pressable accessibilityRole="button" onPress={()=>confirm(t("native.parent.clearHistory"),
           {action:"history_delete",id:selectedProfile.id,confirm:true})}>
           <Text style={styles.danger}>{t("native.parent.clearHistory")}</Text>
         </Pressable>
         <Pressable accessibilityRole="button" onPress={()=>confirm(t("native.parent.deleteChild"),
           {action:"profile_delete",id:selectedProfile.id,confirm:true},true)}>
           <Text style={styles.danger}>{t("native.parent.deleteChild")}</Text>
         </Pressable>
       </View>:null}
     </View>
     {selectedProfile&&<View style={styles.panel}>
       <Text style={styles.heading}>{t("native.parent.weekly")}</Text>
       <View style={styles.options}>
         <Text style={styles.metric}>🧩 {insight?.playedLast7Days??0} {t("native.parent.plays")}</Text>
         <Text style={styles.metric}>⭐ {insight?.solvedLast7Days??0} {t("native.parent.solved")}</Text>
         <Text style={styles.metric}>⏱ {insight?.minutesLast7Days??0} {t("native.time.minutes")}</Text>
         <Text style={styles.metric}>🎯 {insight?.successRate??0}%</Text>
       </View>
       {(insight?.usageByDay??[]).map(x=><Text key={x.day} style={styles.note}>{x.day}: {x.minutes}m</Text>)}
       <Text style={styles.label}>{t("native.parent.topics")}</Text>
       {(insight?.topTopics??[]).map(x=><Text key={x.topic} style={styles.note}>{x.topic} · {x.count}</Text>)}
     </View>}
     {selectedProfile&&<View style={styles.panel}>
       <Text style={styles.heading}>{t("native.parent.devices")}</Text>
       {devices.map(d=><View key={d.id} style={styles.device}>
         <View style={{flex:1}}><Text style={styles.label}>📱 {d.deviceName}</Text>
         <Text style={styles.note}>{new Date(d.expiresAt).toLocaleDateString()}</Text></View>
         <Pressable accessibilityRole="button" onPress={()=>confirm(t("native.parent.revoke"),
             {action:"device_revoke",id:d.id,confirm:true})}>
           <Text style={styles.danger}>{t("native.parent.revoke")}</Text>
         </Pressable>
       </View>)}
       <Text style={styles.label}>{t("native.parent.pair")}</Text>
       <TextInput secureTextEntry keyboardType="number-pad" maxLength={6} value={pairPin}
         onChangeText={setPairPin} placeholder={t("native.guardian.pin")} style={styles.input}/>
       <Pressable accessibilityRole="button" disabled={busy||pairPin.length!==6}
         onPress={()=>void (async()=>{
           if(!token||!parentApi)return;
           setBusy(true);setPairCode("");setError("");
           try{const res=await parentApi.action<{code:string;expiresAt:string}>(token,parent.verifiedToken(),
             {action:"native_pair_issue",profileId:selectedProfile.id,pin:pairPin});
             setPairCode(res.code);setPairPin("");
           }catch{setError(t("native.parent.error"));}finally{setBusy(false);}
         })()} style={styles.secondary}>
         <Text style={styles.secondaryText}>{t("native.parent.pair")}</Text>
       </Pressable>
       {pairCode?<Text selectable style={styles.code}>{pairCode}</Text>:null}
     </View>}
     <View style={styles.panel}>
       <Text style={styles.heading}>{t("native.parent.pinChange")}</Text>
       <TextInput secureTextEntry keyboardType="number-pad" maxLength={6} value={previousPin}
         onChangeText={setPreviousPin} placeholder={t("native.parent.oldPin")} style={styles.input}/>
       <TextInput secureTextEntry keyboardType="number-pad" maxLength={6} value={newPin}
         onChangeText={setNewPin} placeholder={t("native.parent.newPin")} style={styles.input}/>
       <Pressable accessibilityRole="button" disabled={busy||previousPin.length!==6||newPin.length!==6}
         style={styles.secondary} onPress={()=>void (async()=>{
           const done=await perform({action:"pin_change",previous:previousPin,pin:newPin},t("native.parent.saved"));
           setPreviousPin("");setNewPin("");
           if(done){parent.clear();router.replace("/setup");void kid.reload();}
         })()}>
         <Text style={styles.secondaryText}>{t("native.parent.pinChange")}</Text>
       </Pressable>
       <Text style={styles.note}>{t("native.parent.pinWarning")}</Text>
     </View>
   </>}
   {error?<Text accessibilityRole="alert" style={styles.danger}>{error}</Text>:null}
   {notice?<Text accessibilityRole="alert" style={styles.success}>{notice}</Text>:null}
   <Pressable accessibilityRole="button" style={styles.button} onPress={()=>void (async()=>{
     await parent.revoke();router.replace("/");
   })()}><Text style={styles.buttonText}>{t("native.parent.done")}</Text></Pressable>
 </Screen>;
}
const styles=StyleSheet.create({
 heading:{fontSize:21,fontWeight:"900",color:theme.colors.ink},
 label:{fontSize:15,fontWeight:"800",color:theme.colors.ink},
 panel:{backgroundColor:theme.colors.card,padding:18,borderRadius:22,gap:12},
 note:{color:theme.colors.muted,fontSize:13,lineHeight:20},
 options:{flexDirection:"row",flexWrap:"wrap",gap:9},
 choice:{paddingHorizontal:15,paddingVertical:12,borderRadius:14,backgroundColor:theme.colors.background,
   borderWidth:1,borderColor:theme.colors.outline,minHeight:44,justifyContent:"center"},
 chosen:{backgroundColor:theme.colors.accent},
 choiceText:{color:theme.colors.ink,fontWeight:"700",fontSize:14},
 chosenText:{color:"#FFFFFF"},
 input:{borderColor:theme.colors.outline,borderWidth:1,borderRadius:14,padding:14,fontSize:16,color:theme.colors.ink},
 button:{backgroundColor:theme.colors.accent,borderRadius:16,alignItems:"center",padding:18},
 buttonText:{color:"#FFFFFF",fontSize:16,fontWeight:"900"},
 secondary:{backgroundColor:theme.colors.mint,padding:16,borderRadius:15,alignItems:"center"},
 secondaryText:{fontSize:15,fontWeight:"800",color:theme.colors.ink},
 actions:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",padding:8,gap:10},
 danger:{color:theme.colors.error,fontSize:15,fontWeight:"700"},
 device:{flexDirection:"row",alignItems:"center",gap:12},
 code:{fontSize:20,fontWeight:"900",letterSpacing:1,color:theme.colors.accent,textAlign:"center"},
 metric:{backgroundColor:theme.colors.lilac,borderRadius:13,padding:12,fontSize:14,fontWeight:"800",color:theme.colors.ink},
 success:{color:"#207354",fontSize:15,fontWeight:"800"},
 disabled:{opacity:0.45}
});
