import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Banner } from "../../src/components/Screen";
import { AdventureTile } from "../../src/components/AdventureTile";
import { useKidsLocale } from "../../src/state/locale";
import { publicApi } from "../../src/services/api";
import { theme } from "../../src/theme";

const journeys=[
 {emoji:"🦕",title:"kids.topic.dinosaurs",desc:"kids.topic.dinosaursDesc",type:"animal",topic:"dinosaur",tint:theme.colors.lilac},
 {emoji:"🦁",title:"kids.topic.animals",desc:"kids.topic.animalsDesc",type:"animal",topic:"",tint:theme.colors.peach},
 {emoji:"🌍",title:"kids.topic.world",desc:"kids.topic.worldDesc",type:"place",topic:"",tint:theme.colors.mint},
 {emoji:"🚀",title:"kids.topic.science",desc:"kids.topic.scienceDesc",type:"concept",topic:"",tint:theme.colors.sky},
] as const;

export default function KidsHome(){
 const router=useRouter(),{width}=useWindowDimensions();
 const {locale,chooseLocale,t}=useKidsLocale();
 const [health,setHealth]=useState<"missing"|"loading"|"ready"|"error">("loading");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  if(!publicApi){setHealth("missing");return ()=>controller.abort();}
  setHealth("loading");
  void publicApi.health(controller.signal).then(()=>{if(!controller.signal.aborted)setHealth("ready");})
   .catch(()=>{if(!controller.signal.aborted)setHealth("error");});
  return ()=>controller.abort();
 },[retry]);
 return <Screen title={t("kids.welcome")} subtitle={t("kids.subtitle")}>
  <Banner emoji="✨" title="QuizDip Kids" detail={t("native.choose")}/>
  <View style={styles.locale}>
   <Text style={styles.smallTitle}>{t("native.language")}</Text>
   <View style={styles.choiceRow}>
    {(["en","ko"] as const).map(option=><Pressable key={option}
     accessibilityRole="button" accessibilityState={{selected:locale===option}}
     onPress={()=>chooseLocale(option)} style={[styles.choice,locale===option&&styles.choiceActive]}>
     <Text style={[styles.choiceText,locale===option&&styles.choiceTextActive]}>{option==="en"?"English":"한국어"}</Text>
    </Pressable>)}
   </View>
   <Text style={styles.note}>{t("native.languageNote")}</Text>
  </View>
  <Text style={styles.heading}>{t("kids.chooseTopic")}</Text>
  <View style={[styles.grid,{gap:width>=720?16:12}]}>
   {journeys.map(item=><View key={item.title} style={{width:width>=720?"48%":"100%"}}>
     <AdventureTile emoji={item.emoji} title={t(item.title)} detail={t(item.desc)}
      tint={item.tint} onPress={()=>router.push({pathname:"/explore",params:{answerType:item.type,topic:item.topic}})}/>
    </View>)}
  </View>
  <View style={styles.status}>
   <Text style={styles.smallTitle}>{t("native.connectTitle")}</Text>
   <Text style={styles.note}>{health==="ready"?t("native.connected"):
      health==="missing"?t("native.notConfigured"):
      health==="error"?t("native.unavailable"):t("common.loading")}</Text>
   {health==="error"?<Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)}>
     <Text style={styles.retry}>{t("native.retry")} ↻</Text>
   </Pressable>:null}
  </View>
  <Text style={styles.note}>{t("native.setupRequired")}</Text>
 </Screen>;
}
const styles=StyleSheet.create({
 locale:{backgroundColor:theme.colors.card,padding:16,borderRadius:18,gap:9},
 smallTitle:{fontSize:15,color:theme.colors.ink,fontWeight:"800"},
 choiceRow:{flexDirection:"row",gap:9},
 choice:{paddingHorizontal:19,paddingVertical:11,borderRadius:12,backgroundColor:theme.colors.background},
 choiceActive:{backgroundColor:theme.colors.accent},
 choiceText:{fontSize:15,color:theme.colors.ink,fontWeight:"700"},
 choiceTextActive:{color:"#FFFFFF"},
 note:{color:theme.colors.muted,fontSize:13,lineHeight:20},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"},
 status:{backgroundColor:theme.colors.card,borderRadius:18,padding:18,gap:7},
 retry:{color:theme.colors.accent,fontWeight:"800",paddingVertical:8}
});
