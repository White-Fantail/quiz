import { Pressable,StyleSheet,Text,View } from "react-native";
import { useRouter } from "expo-router";
import { Screen,Banner } from "../../src/components/Screen";
import { useKidsLocale } from "../../src/state/locale";
import { theme } from "../../src/theme";
export default function ChallengeScreen(){
 const {t}=useKidsLocale(),router=useRouter();
 return <Screen title={t("kids.challenge.title")} subtitle={t("native.play.fiveDesc")}>
   <Banner emoji="🧩" title={t("native.play.chooseMode")} detail={t("native.play.fiveDesc")} tint={theme.colors.sky}/>
   <Pressable accessibilityRole="button" style={styles.tile}
     onPress={()=>router.push({pathname:"/game",params:{mode:"RANDOM_FIVE"}})}>
     <Text style={styles.emoji}>🎲</Text>
     <View style={styles.info}><Text style={styles.title}>{t("native.play.fiveTitle")}</Text>
       <Text style={styles.note}>{t("native.play.fiveDesc")}</Text></View>
     <Text style={styles.arrow}>↗</Text>
   </Pressable>
   <Pressable accessibilityRole="button" style={[styles.tile,{backgroundColor:theme.colors.lilac}]}
     onPress={()=>router.push({pathname:"/game",params:{mode:"WEEKLY"}})}>
     <Text style={styles.emoji}>🌟</Text>
     <View style={styles.info}><Text style={styles.title}>{t("native.play.weeklyTitle")}</Text>
       <Text style={styles.note}>{t("native.play.weeklyDesc")}</Text></View>
     <Text style={styles.arrow}>↗</Text>
   </Pressable>
   <Pressable accessibilityRole="button" style={styles.secondary} onPress={()=>router.push("/game")}>
     <Text style={styles.secondaryText}>▶ {t("native.play.resume")}</Text>
   </Pressable>
 </Screen>;
}
const styles=StyleSheet.create({
 tile:{flexDirection:"row",alignItems:"center",gap:16,backgroundColor:theme.colors.mint,
   borderRadius:22,padding:18,minHeight:125},
 emoji:{fontSize:40},info:{flex:1,gap:7},
 title:{fontSize:21,fontWeight:"900",color:theme.colors.ink},
 note:{fontSize:14,lineHeight:21,color:theme.colors.muted},
 arrow:{fontSize:24,fontWeight:"800",color:theme.colors.ink},
 secondary:{backgroundColor:theme.colors.card,borderWidth:1,borderColor:theme.colors.outline,
  padding:18,borderRadius:18,alignItems:"center"},
 secondaryText:{color:theme.colors.accent,fontSize:16,fontWeight:"800"}
});
