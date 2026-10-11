import { ActivityIndicator,Pressable,StyleSheet,Text,View } from "react-native";
import { Redirect,useRouter } from "expo-router";
import { Screen,Banner } from "../src/components/Screen";
import { useKidsTime } from "../src/state/time";
import { useKidsSession } from "../src/state/session";
import { useKidsLocale } from "../src/state/locale";
import { theme } from "../src/theme";
export default function TimeUp(){
 const kid=useKidsSession(),time=useKidsTime(),{t}=useKidsLocale(),router=useRouter();
 if(kid.status==="unpaired")return <Redirect href="/setup"/>;
 if(time.status==="allowed")return <Redirect href="/"/>;
 return <Screen title={t("native.time.title")}>
   <Banner emoji="🌙" title={t("native.time.title")}
     detail={time.reason==="kid_daily_limit"?t("native.time.daily"):
       time.reason==="kid_break_required"||time.reason==="kid_session_limit"?t("native.time.break"):
       t("native.time.offline")} tint={theme.colors.peach}/>
   <View style={styles.panel}>
     {time.status==="checking"?<ActivityIndicator color={theme.colors.accent}/>:null}
     {time.time?.limits.dailyMinutes? <Text style={styles.detail}>
       {t("native.time.used")} {time.time.usedMinutes} / {time.time.limits.dailyMinutes} {t("native.time.minutes")}
     </Text>:null}
     <Pressable accessibilityRole="button" onPress={()=>void time.refresh()} style={styles.button}>
       <Text style={styles.buttonText}>{t("native.time.retry")}</Text>
     </Pressable>
     <Pressable accessibilityRole="button" onPress={()=>router.push("/parent")} style={styles.secondary}>
       <Text style={styles.secondaryText}>🔒 {t("native.guardian.open")}</Text>
     </Pressable>
   </View>
 </Screen>;
}
const styles=StyleSheet.create({
 panel:{gap:16,padding:20,borderRadius:20,backgroundColor:theme.colors.card},
 detail:{color:theme.colors.ink,fontWeight:"800",fontSize:18,textAlign:"center"},
 button:{padding:17,backgroundColor:theme.colors.accent,borderRadius:16,alignItems:"center"},
 buttonText:{color:"#FFFFFF",fontWeight:"800",fontSize:17},
 secondary:{padding:17,backgroundColor:theme.colors.mint,borderRadius:16,alignItems:"center"},
 secondaryText:{color:theme.colors.ink,fontWeight:"800",fontSize:16}
});
