import { useCallback,useState } from "react";
import { ActivityIndicator,Pressable,StyleSheet,Text,View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { KidTreasures } from "@quizdip/api-client";
import { Screen,Banner } from "../../src/components/Screen";
import { kidsApi } from "../../src/services/api";
import { useKidsLocale } from "../../src/state/locale";
import { useKidsSession } from "../../src/state/session";
import { theme } from "../../src/theme";
export default function TreasuresScreen(){
 const {t}=useKidsLocale(),kid=useKidsSession();
 const token=kid.status==="active"?kid.token:null;
 const [data,setData]=useState<KidTreasures|null>(null);
 const [error,setError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{
   let live=true;
   setData(null);setLoading(true);setError(false);
   if(!token||!kidsApi){setLoading(false);setError(true);return ()=>{live=false;};}
   void kidsApi.treasures(token).then(v=>{if(live)setData(v);})
     .catch(()=>{if(live)setError(true);})
     .finally(()=>{if(live)setLoading(false);});
   return ()=>{live=false;};
 },[token,retry]));
 return <Screen title={t("kids.treasures.title")} subtitle={t("native.treasure.private")}>
   <Banner emoji="⭐" title={t("native.treasure.heading")} detail={t("native.treasure.private")} tint={theme.colors.lilac}/>
   {loading?<ActivityIndicator color={theme.colors.accent}/>:
     error?<Pressable accessibilityRole="button" onPress={()=>setRetry(x=>x+1)} style={styles.card}>
       <Text style={styles.note}>{t("native.treasure.error")} ↻</Text>
     </Pressable>:
     data?<View style={{gap:18}}>
       <View style={styles.stats}>
         <View style={styles.stat}><Text style={styles.value}>{data.solved}</Text>
           <Text style={styles.note}>{t("native.treasure.solved")}</Text></View>
         <View style={styles.stat}><Text style={styles.value}>{data.completed}</Text>
           <Text style={styles.note}>{t("native.treasure.played")}</Text></View>
       </View>
       <Text style={styles.heading}>{t("native.treasure.badges")}</Text>
       <View style={styles.tiles}>
         {data.badges.length?data.badges.map(b=><View key={b.id} style={styles.badge}>
           <Text style={{fontSize:35}}>{b.emoji}</Text>
           <Text style={styles.badgeText}>{b.id==="first"?t("native.treasure.first"):
             b.id==="five"?t("native.treasure.five"):t("native.treasure.ten")}</Text>
         </View>):<Text style={styles.note}>{t("native.treasure.firstGoal")}</Text>}
       </View>
       <Text style={styles.heading}>{t("native.treasure.discoveries")}</Text>
       {data.discoveries.length?data.discoveries.map(x=><View key={x.quizId} style={styles.card}>
         <Text style={styles.symbol}>🌟</Text><Text style={styles.item}>{x.title}</Text>
       </View>):<Text style={styles.note}>{t("native.treasure.empty")}</Text>}
     </View>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 stats:{flexDirection:"row",gap:13},stat:{flex:1,alignItems:"center",backgroundColor:theme.colors.card,padding:20,borderRadius:20},
 value:{fontSize:34,fontWeight:"900",color:theme.colors.accent},
 note:{fontSize:14,lineHeight:22,color:theme.colors.muted,textAlign:"center"},
 heading:{fontSize:22,fontWeight:"900",color:theme.colors.ink},
 tiles:{flexDirection:"row",flexWrap:"wrap",gap:12},
 badge:{backgroundColor:theme.colors.peach,padding:18,borderRadius:18,alignItems:"center",gap:8,minWidth:140,flex:1},
 badgeText:{fontSize:15,fontWeight:"800",color:theme.colors.ink,textAlign:"center"},
 card:{flexDirection:"row",alignItems:"center",gap:14,padding:18,borderRadius:18,backgroundColor:theme.colors.card},
 symbol:{fontSize:23},item:{fontSize:16,fontWeight:"800",color:theme.colors.ink,flex:1}
});
