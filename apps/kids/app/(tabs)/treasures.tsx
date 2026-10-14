import {useKidsNavigation} from "../../src/useKidsNavigation";
import { KidsTap } from "../../src/components/KidsTap";
import {useCallback,useState} from "react";
import {ActivityIndicator,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {useFocusEffect} from "expo-router";
import type {KidTreasures} from "@quizdip/api-client";
import {Screen} from "../../src/components/Screen";
import {KidsEmojiIcon} from "../../src/components/KidsIcon";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {TreasureChestArtwork} from "../../src/components/TreasureChestArtwork";
import {adventureById,adventureForPack} from "../../src/adventures";
import {kidsApi} from "../../src/services/api";
import {useKidsLocale} from "../../src/state/locale";
import {useKidsSession} from "../../src/state/session";
import {theme} from "../../src/theme";

const badgeSlots=[
 {id:"first",emoji:"🌟",label:"native.treasure.first" as const,tint:"#FFE3A6",required:1},
 {id:"five",emoji:"🧭",label:"native.treasure.five" as const,tint:"#D5F3E7",required:5},
 {id:"ten",emoji:"🏆",label:"native.treasure.ten" as const,tint:"#FFDCD2",required:10},
];

export default function TreasuresScreen(){
 const {t}=useKidsLocale(),kid=useKidsSession(),go=useKidsNavigation(),{width}=useWindowDimensions();
 const token=kid.status==="active"?kid.token:null;
 const [data,setData]=useState<KidTreasures|null>(null);
 const [error,setError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{
   let live=true;
   setData(null);setLoading(true);setError(false);
   if(!token||!kidsApi){setLoading(false);setError(true);return()=>{live=false;};}
   void kidsApi.treasures(token).then(v=>{if(live)setData(v);})
     .catch(()=>{if(live)setError(true);})
     .finally(()=>{if(live)setLoading(false);});
   return ()=>{live=false;};
 },[token,retry]));
 const columns=width>=720?3:2;
 const earned=new Set(data?.badges.map(b=>b.id)||[]);
 return <Screen title={t("kids.treasures.title")} subtitle={t("native.treasure.private")}>
   <View style={styles.hero}>
     <View style={styles.heroCopy}>
       <Text style={styles.eyebrow}>{t("native.treasure.collection")}</Text>
       <Text style={styles.heroTitle}>{t("native.treasure.hero")}</Text>
       <Text style={styles.heroSubtitle}>{t("native.treasure.heroDetail")}</Text>
       {data?<View style={styles.heroTag}>
          <KidsEmojiIcon emoji="⭐" size={18} color={theme.colors.ink}/>
          <Text style={styles.heroTagText}>{earned.size} / {badgeSlots.length} {t("native.treasure.badgesFound")}</Text>
        </View>:null}
     </View>
     <View pointerEvents="none" style={styles.heroArt}><TreasureChestArtwork size={width>=720?196:151}/></View>
   </View>

   {loading?<View style={styles.loading}>
     <ActivityIndicator size="large" color={theme.colors.accent}/>
     <Text style={styles.note}>{t("native.treasure.loading")}</Text>
   </View>:null}
   {error?<KidsTap accessibilityRole="button" onPress={()=>setRetry(x=>x+1)} style={styles.error}>
     <Text style={styles.errorText}>{t("native.treasure.error")} ↻</Text>
   </KidsTap>:null}
   {data?<View style={styles.sections}>
     <View style={styles.stats}>
       <View style={[styles.stat,{backgroundColor:"#FFEBD6"}]}>
         <View style={styles.statTop}><KidsEmojiIcon emoji="⭐" size={26}/><Text style={styles.statBig}>{data.solved}</Text></View>
         <Text style={styles.statText}>{t("native.treasure.solved")}</Text>
       </View>
       <View style={[styles.stat,{backgroundColor:"#DDF4EC"}]}>
         <View style={styles.statTop}><KidsEmojiIcon emoji="🧩" size={26}/><Text style={styles.statBig}>{data.completed}</Text></View>
         <Text style={styles.statText}>{t("native.treasure.played")}</Text>
       </View>
     </View>
     <View style={styles.section}>
       <Text style={styles.heading}>{t("native.treasure.badges")}</Text>
       <Text style={styles.subheading}>{t("native.treasure.badgeLead")}</Text>
       <View style={styles.badgeGrid}>
         {badgeSlots.map(badge=>{
           const unlocked=earned.has(badge.id);
           return <View key={badge.id} accessible
             accessibilityLabel={t(badge.label)+". "+t(unlocked?"native.treasure.unlocked":"native.treasure.locked")}
             style={[styles.badgeCard,{width:columns===3?"31.8%":"48%",backgroundColor:unlocked?badge.tint:"#EFEBF5"}]}>
             <View style={[styles.medalRing,{backgroundColor:unlocked?"#FFFFFFAA":"#FFFFFF77"}]}>
               <KidsEmojiIcon emoji={unlocked?badge.emoji:"🔒"} size={49} color={unlocked?theme.colors.ink:theme.colors.muted}/>
             </View>
             <Text numberOfLines={2} style={[styles.badgeTitle,!unlocked&&styles.faded]}>{t(badge.label)}</Text>
             <Text style={[styles.badgeStatus,!unlocked&&styles.faded]}>
               {t(unlocked?"native.treasure.unlocked":"native.treasure.locked")}
             </Text>
           </View>;
         })}
       </View>
       {!earned.size?<Text style={styles.encourage}>{t("native.treasure.firstGoal")}</Text>:null}
     </View>
     <View style={styles.section}>
       <Text style={styles.heading}>{t("native.treasure.discoveries")}</Text>
       <Text style={styles.subheading}>{t("native.treasure.discoveryLead")}</Text>
       {data.discoveries.length?<View style={styles.discoveryGrid}>
          {data.discoveries.map(item=>{
            const adventure=adventureForPack({title:item.title,description:""});
            return <View key={item.quizId} style={[styles.discoveryCard,{width:columns===3?"31.8%":"48%"}]}>
              <View style={[styles.sticker,{backgroundColor:adventureById(adventure)?.tint||theme.colors.lilac}]}>
                <AdventureArtwork id={adventure} size={90}/>
              </View>
              <Text numberOfLines={2} style={styles.discoveryTitle}>{item.title}</Text>
              <Text style={styles.discoveredText}>★ {t("native.treasure.discovered")}</Text>
            </View>;
          })}
         </View>:<View style={styles.empty}>
           <KidsEmojiIcon emoji="✨" size={39} color={theme.colors.accent}/>
           <Text style={styles.emptyText}>{t("native.treasure.empty")}</Text>
         </View>}
     </View>
     <KidsTap accessibilityRole="button" onPress={()=>go("/explore")} style={styles.nextButton}>
       <KidsEmojiIcon emoji="🧭" size={22} color="#FFFFFF"/>
       <Text style={styles.nextText}>{t("native.treasure.more")}</Text>
       <Text style={styles.nextArrow}>→</Text>
     </KidsTap>
   </View>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 hero:{borderRadius:30,backgroundColor:"#6E48D8",padding:24,minHeight:221,overflow:"hidden",
   flexDirection:"row",alignItems:"center"},
 heroCopy:{maxWidth:"68%",flex:1,zIndex:1,gap:9},
 eyebrow:{fontWeight:"900",letterSpacing:1,fontSize:12,color:"#FFE48E"},
 heroTitle:{color:"#FFFFFF",fontWeight:"900",fontSize:27,lineHeight:32},
 heroSubtitle:{fontSize:14,lineHeight:20,fontWeight:"600",color:"#F2E9FF"},
 heroArt:{position:"absolute",right:-4,bottom:0},
 heroTag:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:7,
    backgroundColor:"#FFDD82",borderRadius:16,paddingHorizontal:12,paddingVertical:9},
 heroTagText:{fontWeight:"900",fontSize:13,color:theme.colors.ink},
 sections:{gap:23},
 stats:{flexDirection:"row",gap:13},
 stat:{flex:1,padding:18,borderRadius:24,minHeight:113,justifyContent:"space-between",gap:9},
 statTop:{flexDirection:"row",alignItems:"center",gap:12},
 statBig:{fontSize:35,fontWeight:"900",color:theme.colors.ink},
 statText:{fontSize:14,lineHeight:20,fontWeight:"800",color:theme.colors.ink},
 section:{gap:11},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 subheading:{fontSize:14,lineHeight:20,color:theme.colors.muted,fontWeight:"600",marginTop:-6},
 badgeGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:12},
 badgeCard:{minHeight:167,borderRadius:22,padding:12,alignItems:"center",justifyContent:"center",gap:7},
 medalRing:{width:79,height:79,borderRadius:40,alignItems:"center",justifyContent:"center"},
 badgeTitle:{fontWeight:"900",fontSize:15,color:theme.colors.ink,textAlign:"center",lineHeight:19},
 badgeStatus:{fontSize:12,fontWeight:"800",color:"#7655A1"},
 faded:{color:"#9C92AC"},
 encourage:{fontSize:14,color:theme.colors.muted,lineHeight:20},
 discoveryGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:13},
 discoveryCard:{backgroundColor:"#FFFFFF",borderRadius:23,padding:12,
   borderColor:theme.colors.outline,borderWidth:1,gap:8,minHeight:177},
 sticker:{height:99,borderRadius:16,alignItems:"center",justifyContent:"center"},
 discoveryTitle:{color:theme.colors.ink,fontSize:15,lineHeight:19,fontWeight:"900"},
 discoveredText:{fontWeight:"800",fontSize:12,color:theme.colors.accent},
 empty:{minHeight:145,borderRadius:22,padding:20,backgroundColor:theme.colors.lilac,
   alignItems:"center",justifyContent:"center",gap:10},
 emptyText:{fontSize:15,textAlign:"center",color:theme.colors.ink,fontWeight:"700"},
 nextButton:{minHeight:63,backgroundColor:theme.colors.accent,borderRadius:21,
   flexDirection:"row",alignItems:"center",paddingHorizontal:18,gap:13},
 nextText:{fontWeight:"900",fontSize:17,color:"#FFFFFF",flex:1},
 nextArrow:{fontWeight:"900",fontSize:24,color:"#FFFFFF"},
 loading:{alignItems:"center",padding:28,gap:12},
 note:{fontSize:15,color:theme.colors.muted},
 error:{backgroundColor:"#FFECD5",borderRadius:18,padding:20},
 errorText:{fontSize:15,color:theme.colors.ink,fontWeight:"700"},
});
