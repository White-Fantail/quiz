import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {useFocusEffect,useLocalSearchParams} from "expo-router";
import * as SecureStore from "expo-secure-store";
import {useKidsNavigation} from "../../src/useKidsNavigation";
import {Screen} from "../../src/components/Screen";
import {KidsTap} from "../../src/components/KidsTap";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {KidsEmojiIcon} from "../../src/components/KidsIcon";
import {adventures,adventureById,adventureCount,adventureForPack,adventureForQuiz,type AdventureId} from "../../src/adventures";
import {useKidsAdventures} from "../../src/useKidsAdventures";
import {useKidsLocale} from "../../src/state/locale";
import {useKidsSession} from "../../src/state/session";
import {theme} from "../../src/theme";

const SAVED_GAME="quizdip-kids-active-game-v1";
type Selection=AdventureId|"all"|null;
type Resume={kind:"run"|"single";packId?:string;round?:number;total?:number};
async function savedResume():Promise<Resume|null>{
 try{
  const raw=await SecureStore.getItemAsync(SAVED_GAME);
  if(!raw)return null;
  const ref=JSON.parse(raw);
  if(ref?.kind!=="run"&&ref?.kind!=="single")return null;
  const id=ref.kind==="run"?ref.runId:ref.sessionId;
  const token=ref.kind==="run"?ref.runToken:ref.sessionToken;
  if(typeof id!=="string"||typeof token!=="string"||!/[\w-]{32,200}/.test(token))return null;
  const key="quizdip-kids-progress:"+id;
  const rawProgress=await SecureStore.getItemAsync(key);
  let progress:Record<string,{status?:string}>={};
  if(rawProgress?.startsWith("chunks:")){
   const count=Number(rawProgress.slice(7));
   if(count>0&&count<=100&&Number.isInteger(count)){
    const chunks=await Promise.all(Array.from({length:count},(_,i)=>SecureStore.getItemAsync(key+":"+i)));
    if(chunks.every(value=>value!==null))progress=JSON.parse(chunks.join(""));
   }
  }else if(rawProgress)progress=JSON.parse(rawProgress);
  const finished=Object.values(progress).filter(p=>p?.status==="SOLVED"||p?.status==="FAILED").length;
  const total=ref.kind==="single"?1:ref.mode==="RANDOM_FIVE"?5:undefined;
  if(total&&finished>=total)return null;
  return {kind:ref.kind,packId:typeof ref.packId==="string"?ref.packId:undefined,round:finished+1,total};
 }catch{return null;}
}
export default function KidsHome(){
 const go=useKidsNavigation(),{width}=useWindowDimensions(),{t}=useKidsLocale();
 const kid=useKidsSession();
 const nickname=kid.status==="active"?kid.session.profile.nickname.trim():"";
 const {adventure}=useLocalSearchParams<{adventure?:string}>();
 const [selected,setSelected]=useState<Selection>(null);
 const [resume,setResume]=useState<Resume|null>(null);
 const {packs,quizzes,loading,loaded,error,hasMore,loadMore,reload}=useKidsAdventures();
 useEffect(()=>{if(adventure)setSelected(adventureById(adventure)?.id??null);},[adventure]);
 useFocusEffect(useCallback(()=>{
  let live=true;
  void savedResume().then(value=>{if(live)setResume(value);});
  return ()=>{live=false;};
 },[]));
 const available=adventures.filter(item=>adventureCount(item.id,packs,quizzes)>0);
 const worldsToShow=selected==="all"?available:selected?
   available.filter(item=>item.id===selected):available.slice(0,4);
 const filteredPacks=selected&&selected!=="all"?packs.filter(p=>adventureForPack(p)===selected):packs;
 const filteredQuizzes=selected&&selected!=="all"?quizzes.filter(q=>adventureForQuiz(q)===selected):quizzes;
 const shownPacks=selected?filteredPacks:filteredPacks.slice(0,8);
 const shownQuizzes=selected?filteredQuizzes:filteredQuizzes.slice(0,4);
 const wide=width>=720;
 const resumeTitle=packs.find(p=>p.id===resume?.packId)?.title;
 return <Screen title={nickname?t("native.home.hello")+", "+nickname+"!":t("kids.welcome")}
   subtitle={t("native.playTab.lead")}
   headerAction={<KidsTap accessibilityRole="button"
     accessibilityLabel={t("native.guardian.open")} accessibilityHint={t("native.guardian.detail")}
     onPress={()=>go("/parent")} style={styles.parentsButton}>
     <Text style={styles.parentsText}>{t("native.guardian.open")}</Text>
   </KidsTap>}>
  {resume?<KidsTap accessibilityRole="button" onPress={()=>go("/game")} style={styles.resume}>
   <View style={styles.resumeIcon}><KidsEmojiIcon emoji="🧭" size={34}/></View>
   <View style={{flex:1,gap:6}}>
    <Text style={styles.resumeTitle}>{t("native.play.resume")}</Text>
    <Text numberOfLines={2} style={styles.muted}>{resumeTitle||t("native.playTab.resumeDetail")}</Text>
    {resume.total?<Text style={styles.muted}>{t("native.play.question")} {resume.round} / {resume.total}</Text>:null}
   </View><Text style={styles.arrow}>→</Text>
  </KidsTap>:null}
  <View style={styles.section}>
   <View style={styles.headingRow}>
    <Text style={styles.heading}>{t("native.playTab.pickWorld")}</Text>
    <KidsTap accessibilityRole="button" onPress={()=>setSelected("all")}>
     <Text style={styles.link}>{t("native.adventure.all")} →</Text>
    </KidsTap>
   </View>
   {loading&&!loaded?<ActivityIndicator color={theme.colors.accent} size="large"/>:null}
   {error?<KidsTap accessibilityRole="button" onPress={reload} style={styles.notice}>
    <Text style={styles.noticeText}>{t("native.adventure.error")} {t("native.adventure.retry")} ↻</Text>
   </KidsTap>:null}
   {loaded&&available.length===0&&!loading?<Text style={styles.muted}>{t("native.adventure.empty")}</Text>:null}
   <View style={styles.worldGrid}>
    {worldsToShow.map(item=><KidsTap key={item.id} accessibilityRole="button"
      accessibilityLabel={t(item.labelKey)} accessibilityState={{selected:selected===item.id}}
      onPress={()=>setSelected(item.id)}
      style={[styles.world,{backgroundColor:item.tint,borderColor:selected===item.id?theme.colors.accent:"transparent"}]}>
      <AdventureArtwork id={item.id} size={wide?125:96}/>
      <Text numberOfLines={2} style={styles.worldTitle}>{t(item.labelKey)}</Text>
      <Text style={styles.worldCount}>{adventureCount(item.id,packs,quizzes)} {t("native.adventure.toPlay")}</Text>
    </KidsTap>)}
   </View>
  </View>
  <KidsTap accessibilityRole="button" onPress={()=>go({pathname:"/game",params:{mode:"RANDOM_FIVE"}})}
    style={styles.surprise}>
   <AdventureArtwork id="surprise" size={79}/>
   <View style={{flex:1,gap:7}}>
    <Text style={styles.surpriseTitle}>{t("native.playTab.surprise")}</Text>
    <Text style={styles.muted}>{t("native.playTab.surpriseDetail")}</Text>
   </View><Text style={styles.arrow}>→</Text>
  </KidsTap>
  {selected?<KidsTap accessibilityRole="button" onPress={()=>setSelected(null)} style={styles.filter}>
   <Text style={styles.link}>{selected==="all"?t("native.adventure.allWorlds"):t(adventureById(selected)!.labelKey)} ×</Text>
  </KidsTap>:null}
  {shownPacks.length>0?<View style={styles.section}>
   <View style={styles.headingRow}>
    <Text style={styles.heading}>{t("native.adventure.packs")}</Text>
    {!selected?<KidsTap accessibilityRole="button" onPress={()=>setSelected("all")}>
     <Text style={styles.link}>{t("native.adventure.all")} →</Text>
    </KidsTap>:null}
   </View>
   <View style={styles.packGrid}>
    {shownPacks.map(pack=><KidsTap key={pack.id} accessibilityRole="button"
      accessibilityLabel={pack.title} onPress={()=>go({pathname:"/game",params:{packId:pack.id}})}
      style={[styles.pack,{width:wide?"48.7%":"100%"}]}>
      <View style={[styles.art,{backgroundColor:adventureById(adventureForPack(pack))?.tint||theme.colors.lilac}]}>
       <AdventureArtwork id={adventureForPack(pack)} size={wide?110:90}/>
      </View>
      <View style={styles.copy}>
       <Text numberOfLines={2} style={styles.packTitle}>{pack.title}</Text>
       <Text style={styles.muted}>{pack.questionCount} {t("native.adventure.questions")}</Text>
       <Text style={styles.link}>{t("native.adventure.open")} ▶</Text>
      </View>
    </KidsTap>)}
   </View>
  </View>:null}
  {shownQuizzes.length>0?<View style={styles.section}>
   <Text style={styles.heading}>{t("native.adventure.quizzes")}</Text>
   <View style={styles.packGrid}>
    {shownQuizzes.map(quiz=><KidsTap key={quiz.id} accessibilityRole="button" accessibilityLabel={quiz.title}
      onPress={()=>go({pathname:"/game",params:{quizId:quiz.id}})}
      style={[styles.pack,{width:wide?"48.7%":"100%"}]}>
      <View style={[styles.art,{backgroundColor:adventureById(adventureForQuiz(quiz))?.tint||theme.colors.lilac}]}>
       <AdventureArtwork id={adventureForQuiz(quiz)} size={90}/>
      </View>
      <View style={styles.copy}>
       <Text numberOfLines={2} style={styles.packTitle}>{quiz.title}</Text>
       <Text style={styles.muted}>{t("native.play.single")}</Text>
       <Text style={styles.link}>{t("native.adventure.open")} ▶</Text>
      </View>
    </KidsTap>)}
   </View>
  </View>:null}
  {selected&&loaded&&!loading&&filteredPacks.length===0&&filteredQuizzes.length===0?<View style={styles.notice}>
   <Text style={styles.noticeText}>{t("native.adventure.emptyWorld")}</Text>
  </View>:null}
  {loaded&&hasMore?<KidsTap accessibilityRole="button" disabled={loading} onPress={loadMore} style={styles.more}>
   <Text style={styles.link}>{loading?t("native.adventure.loading"):t("native.adventure.more")}</Text>
  </KidsTap>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 parentsButton:{minHeight:44,borderRadius:17,borderWidth:1,borderColor:theme.colors.outline,
  backgroundColor:"#FFFFFF",paddingHorizontal:15,justifyContent:"center",alignItems:"center"},
 parentsText:{color:theme.colors.accent,fontWeight:"800",fontSize:14},
 section:{gap:14},
 headingRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:9},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink,flexShrink:1},
 link:{fontSize:14,fontWeight:"900",color:theme.colors.accent},
 muted:{fontSize:13,fontWeight:"700",color:theme.colors.muted},
 resume:{backgroundColor:"#D7F5E8",borderRadius:23,padding:16,flexDirection:"row",alignItems:"center",gap:12},
 resumeIcon:{height:59,width:59,borderRadius:18,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center"},
 resumeTitle:{color:theme.colors.ink,fontWeight:"900",fontSize:19},
 arrow:{fontSize:25,fontWeight:"900",color:theme.colors.accent},
 worldGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:11},
 world:{width:"48.7%",borderRadius:23,borderWidth:3,minHeight:175,
   padding:9,alignItems:"center",justifyContent:"center",gap:6},
 worldTitle:{fontSize:18,fontWeight:"900",lineHeight:22,textAlign:"center",color:theme.colors.ink},
 worldCount:{fontSize:12,fontWeight:"800",color:theme.colors.accent},
 surprise:{borderRadius:24,padding:15,backgroundColor:"#E9DEFF",flexDirection:"row",
  alignItems:"center",gap:10},
 surpriseTitle:{fontSize:21,fontWeight:"900",color:theme.colors.ink},
 filter:{alignSelf:"flex-start",paddingHorizontal:15,paddingVertical:11,
  borderRadius:17,backgroundColor:theme.colors.lilac},
 packGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:12},
 pack:{minHeight:150,borderWidth:1,borderColor:theme.colors.outline,backgroundColor:"#FFFFFF",
  borderRadius:23,flexDirection:"row",overflow:"hidden"},
 art:{width:"37%",alignItems:"center",justifyContent:"center"},
 copy:{padding:13,flex:1,justifyContent:"space-around",gap:7},
 packTitle:{fontSize:18,fontWeight:"900",lineHeight:22,color:theme.colors.ink},
 notice:{backgroundColor:"#FFF1DD",padding:15,borderRadius:15},
 noticeText:{fontSize:14,color:theme.colors.ink,fontWeight:"700"},
 more:{borderRadius:19,padding:17,backgroundColor:theme.colors.lilac,alignItems:"center"},
});
