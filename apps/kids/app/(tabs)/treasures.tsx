import {useCallback,useState} from "react";
import {ActivityIndicator,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {useFocusEffect} from "expo-router";
import type {KidTreasures} from "@quizdip/api-client";
import {useKidsNavigation} from "../../src/useKidsNavigation";
import {KidsTap} from "../../src/components/KidsTap";
import {Screen} from "../../src/components/Screen";
import {KidsEmojiIcon} from "../../src/components/KidsIcon";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {adventureById,adventureForPack} from "../../src/adventures";
import {kidsApi} from "../../src/services/api";
import {useKidsLocale} from "../../src/state/locale";
import {useKidsSession} from "../../src/state/session";
import {theme} from "../../src/theme";

const badgeSlots=[
 {id:"first",emoji:"🌟",label:"native.treasure.first" as const},
 {id:"five",emoji:"🧭",label:"native.treasure.five" as const},
 {id:"ten",emoji:"🏆",label:"native.treasure.ten" as const}
];

export default function TreasuresScreen(){
 const {t}=useKidsLocale(),kid=useKidsSession(),go=useKidsNavigation(),{width}=useWindowDimensions();
 const token=kid.status==="active"?kid.token:null;
 const [data,setData]=useState<KidTreasures|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{
  let live=true;
  setLoading(true);setError(false);
  if(!token||!kidsApi){setLoading(false);setError(true);return()=>{live=false;};}
  void kidsApi.treasures(token).then(value=>{if(live)setData(value);})
   .catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[token,retry]));
 const earned=new Set(data?.badges.map(b=>b.id)||[]);
 const wide=width>=720;
 return <Screen title={t("native.stars.title")} subtitle={t("native.stars.lead")}>
   {loading?<ActivityIndicator size="large" color={theme.colors.accent}/>:null}
   {error?<KidsTap accessibilityRole="button" onPress={()=>setRetry(n=>n+1)} style={styles.notice}>
     <Text style={styles.noticeText}>{t("native.treasure.error")} ↻</Text>
   </KidsTap>:null}
   {data?<View style={styles.sections}>
     <View style={styles.stats}>
       <View style={[styles.stat,{backgroundColor:"#FFE7AA"}]}>
         <KidsEmojiIcon emoji="⭐" size={35}/>
         <Text style={styles.statValue}>{data.solved}</Text>
         <Text style={styles.statLabel}>{t("native.treasure.solved")}</Text>
       </View>
       <View style={[styles.stat,{backgroundColor:"#D6F3E7"}]}>
         <KidsEmojiIcon emoji="🧩" size={35}/>
         <Text style={styles.statValue}>{data.completed}</Text>
         <Text style={styles.statLabel}>{t("native.treasure.played")}</Text>
       </View>
     </View>
     <View style={styles.section}>
       <Text style={styles.heading}>{t("native.stars.recentPacks")}</Text>
       {data.recentPacks?.length?<View style={styles.grid}>
         {data.recentPacks.map(pack=>{
           const world=adventureForPack({title:pack.title,description:""});
           return <View key={pack.packId} style={[styles.packCard,{width:wide?"48.7%":"100%"}]}>
             <View style={styles.row}>
               <View style={[styles.art,{backgroundColor:adventureById(world)?.tint||theme.colors.lilac}]}>
                 <AdventureArtwork id={world} size={71}/>
               </View>
               <View style={{flex:1,gap:6}}>
                 <Text numberOfLines={2} style={styles.packTitle}>{pack.title}</Text>
                 <Text style={styles.meta}>⭐ {pack.score} {t("native.play.points")} · {pack.solved}/{pack.total}</Text>
                 <Text style={styles.best}>{t("native.stars.best")} {pack.bestScore} {t("native.play.points")}</Text>
               </View>
             </View>
             <KidsTap accessibilityRole="button" onPress={()=>go({pathname:"/game",params:{packId:pack.packId}})}
               style={styles.replay}><Text style={styles.replayText}>{t("native.stars.playAgain")} →</Text></KidsTap>
           </View>;
         })}
       </View>:<Text style={styles.note}>{t("native.stars.noPacks")}</Text>}
     </View>
     <View style={styles.section}>
       <Text style={styles.heading}>{t("native.stars.recentSolved")}</Text>
       {data.discoveries.length?<View style={styles.grid}>
         {data.discoveries.slice(0,8).map(item=>{
           const world=adventureForPack({title:item.title,description:""});
           return <KidsTap key={item.quizId} accessibilityRole="button" accessibilityLabel={item.title}
             onPress={()=>go({pathname:"/game",params:{quizId:item.quizId}})}
             style={[styles.discovery,{width:wide?"48.7%":"100%"}]}>
             <View style={[styles.smallArt,{backgroundColor:adventureById(world)?.tint||theme.colors.lilac}]}>
               <AdventureArtwork id={world} size={64}/>
             </View>
             <View style={{flex:1,gap:7}}>
               <Text numberOfLines={2} style={styles.packTitle}>{item.title}</Text>
               <Text style={styles.best}>+{item.score} {t("native.play.points")} ▶</Text>
             </View>
           </KidsTap>;
         })}
       </View>:<Text style={styles.note}>{t("native.treasure.empty")}</Text>}
     </View>
     <View style={styles.section}>
       <Text style={styles.heading}>{t("native.treasure.badges")}</Text>
       <View style={styles.badges}>
         {badgeSlots.map(badge=><View key={badge.id} accessible
           accessibilityLabel={t(badge.label)+". "+t(earned.has(badge.id)?"native.treasure.unlocked":"native.treasure.locked")}
           style={[styles.badge,{opacity:earned.has(badge.id)?1:.48}]}>
           <KidsEmojiIcon emoji={earned.has(badge.id)?badge.emoji:"🔒"} size={35}/>
           <Text style={styles.badgeText}>{t(badge.label)}</Text>
         </View>)}
       </View>
     </View>
     <KidsTap accessibilityRole="button" onPress={()=>go("/")} style={styles.back}>
       <KidsEmojiIcon emoji="🏠" size={23} color="#FFFFFF"/>
       <Text style={styles.backText}>{t("native.stars.moreGames")} →</Text>
     </KidsTap>
   </View>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 sections:{gap:26},
 stats:{flexDirection:"row",gap:12},
 stat:{flex:1,borderRadius:24,padding:17,alignItems:"center",gap:8},
 statValue:{fontSize:40,fontWeight:"900",color:theme.colors.ink},
 statLabel:{fontSize:13,fontWeight:"800",textAlign:"center",color:theme.colors.ink},
 section:{gap:12},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 note:{fontSize:15,lineHeight:21,color:theme.colors.muted},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:12},
 packCard:{backgroundColor:"#FFFFFF",borderRadius:21,borderWidth:1,
   borderColor:theme.colors.outline,padding:13,gap:12},
 row:{flexDirection:"row",alignItems:"center",gap:12},
 art:{height:83,width:83,borderRadius:17,alignItems:"center",justifyContent:"center"},
 packTitle:{fontSize:16,lineHeight:20,fontWeight:"900",color:theme.colors.ink},
 meta:{fontSize:13,fontWeight:"700",color:theme.colors.muted},
 best:{fontSize:13,fontWeight:"900",color:theme.colors.accent},
 replay:{alignItems:"center",borderRadius:15,backgroundColor:theme.colors.lilac,padding:10},
 replayText:{fontSize:14,fontWeight:"900",color:theme.colors.accent},
 discovery:{flexDirection:"row",alignItems:"center",minHeight:94,gap:12,padding:10,
   borderRadius:19,borderWidth:1,borderColor:theme.colors.outline,backgroundColor:"#FFFFFF"},
 smallArt:{width:76,height:72,borderRadius:16,alignItems:"center",justifyContent:"center"},
 badges:{flexDirection:"row",justifyContent:"space-between",gap:10},
 badge:{flex:1,alignItems:"center",paddingVertical:14,paddingHorizontal:4,
   borderRadius:18,backgroundColor:theme.colors.lilac,gap:8},
 badgeText:{fontSize:12,fontWeight:"800",textAlign:"center",color:theme.colors.ink},
 back:{backgroundColor:theme.colors.accent,borderRadius:19,
   padding:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10},
 backText:{fontSize:17,fontWeight:"900",color:"#FFFFFF"},
 notice:{backgroundColor:"#FFF1DD",borderRadius:17,padding:16},
 noticeText:{color:theme.colors.ink,fontWeight:"700",fontSize:14},
});
