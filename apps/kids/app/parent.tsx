import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { ApiError } from "@quizdip/api-client";
import { Screen, Banner } from "../src/components/Screen";
import { useKidsSession } from "../src/state/session";
import { useKidsLocale } from "../src/state/locale";
import { theme } from "../src/theme";

export default function ParentGate(){
 const kid=useKidsSession(),{t}=useKidsLocale(),router=useRouter();
 const [pin,setPin]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 if(kid.status==="unpaired")return <Redirect href="/setup" />;
 if(kid.status==="checking"||kid.status==="unavailable")return <Screen title={t("native.session.checking")}>
    <Pressable accessibilityRole="button" onPress={()=>void kid.reload()}>
      <Text style={styles.action}>{t("native.session.retry")}</Text>
    </Pressable>
   </Screen>;
 const unlock=async()=>{
   if(pin.length!==6||busy)return;
   setBusy(true);setError("");
   try {await kid.unlock(pin);setPin("");router.replace("/setup");}
   catch(e){setPin("");setError(e instanceof ApiError && e.code==="kid_pin_locked"
     ?t("native.guardian.locked"):t("native.guardian.failed"));}
   finally{setBusy(false);}
 };
 return <Screen title={t("native.guardian.title")} subtitle={t("native.guardian.detail")}>
   <Banner emoji="🔒" title={t("native.guardian.title")} detail={t("native.guardian.settings")}/>
   <View style={styles.panel}>
     <Text style={styles.label}>{t("native.guardian.pin")}</Text>
     <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad"
       secureTextEntry maxLength={6} accessibilityLabel={t("native.guardian.pin")}
       style={styles.field}/>
     {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
     <Pressable accessibilityRole="button" disabled={pin.length!==6||busy}
       onPress={()=>void unlock()} style={[styles.button,(pin.length!==6||busy)&&styles.disabled]}>
       <Text style={styles.buttonText}>{t("native.guardian.unlock")}</Text>
     </Pressable>
     <Pressable accessibilityRole="button" onPress={()=>router.replace("/")}>
       <Text style={styles.action}>{t("native.guardian.back")}</Text>
     </Pressable>
   </View>
 </Screen>;
}
const styles=StyleSheet.create({
 panel:{padding:20,borderRadius:20,backgroundColor:theme.colors.card,gap:14},
 label:{fontSize:16,fontWeight:"800",color:theme.colors.ink},
 field:{borderColor:theme.colors.outline,borderWidth:1,borderRadius:14,padding:15,
  color:theme.colors.ink,fontSize:20},
 error:{color:theme.colors.error},
 button:{padding:17,backgroundColor:theme.colors.accent,borderRadius:16,alignItems:"center"},
 buttonText:{fontSize:16,color:"#FFFFFF",fontWeight:"800"},
 disabled:{opacity:0.45},
 action:{color:theme.colors.accent,textAlign:"center",fontWeight:"700",padding:12}
});
