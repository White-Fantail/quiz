import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { ApiError } from "@quizdip/api-client";
import { Screen, Banner } from "../src/components/Screen";
import { useKidsLocale } from "../src/state/locale";
import { useKidsSession } from "../src/state/session";
import { publicApi } from "../src/services/api";
import { theme } from "../src/theme";

export default function SetupScreen(){
 const session=useKidsSession(),{locale,chooseLocale,t}=useKidsLocale();
 const [code,setCode]=useState(""),[deviceName,setDeviceName]=useState("My iPad");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 if(session.status==="active")return <Redirect href="/" />;
 const parentUrl=publicApi?.origin+"/"+locale+"/account/kids";
 const redeem=async()=>{
   if(busy)return;
   setError("");setBusy(true);
   try{await session.pair(code.toUpperCase().trim(),deviceName.trim());}
   catch(e){
     setError(e instanceof ApiError && ["pair_unavailable","invalid_pair_code"].includes(e.code)
       ?t("native.pair.expired"):t("native.pair.error"));
   }finally{setBusy(false);}
 };
 if(session.status==="checking")return <Screen title="QuizDip Kids">
   <ActivityIndicator size="large" color={theme.colors.accent}/>
   <Text style={styles.note}>{t("native.session.checking")}</Text>
 </Screen>;
 if(session.status==="unavailable")return <Screen title={t("native.session.unavailable")}>
   <Pressable style={styles.button} accessibilityRole="button" onPress={()=>void session.reload()}>
     <Text style={styles.buttonText}>{t("native.session.retry")}</Text>
   </Pressable>
 </Screen>;
 return <Screen title={t("native.pair.title")} subtitle={t("native.pair.detail")}>
   <Banner emoji="🔐" title="QuizDip Kids" detail={t("native.pair.detail")}/>
   <View style={styles.switcher}>
     {(["en","ko"] as const).map(lang=><Pressable key={lang} accessibilityRole="button"
       accessibilityState={{selected:locale===lang}} onPress={()=>chooseLocale(lang)}
       style={[styles.lang,locale===lang&&styles.langSelected]}>
       <Text style={locale===lang?styles.langTextSelected:styles.langText}>{lang==="en"?"English":"한국어"}</Text>
     </Pressable>)}
   </View>
   <View style={styles.outline}>
     <Text style={styles.outlineText}>🔒 {t("native.pair.open")}</Text>
     <Text selectable style={styles.parentUrl}>{parentUrl??t("native.notConfigured")}</Text>
   </View>
   <View style={styles.panel}>
     <Text style={styles.label}>{t("native.pair.code")}</Text>
     <TextInput value={code} onChangeText={setCode} autoCapitalize="characters"
       autoCorrect={false} maxLength={32} placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
       accessibilityLabel={t("native.pair.code")} style={styles.field}/>
     <Text style={styles.label}>{t("native.pair.device")}</Text>
     <TextInput value={deviceName} onChangeText={setDeviceName} maxLength={50}
       autoCorrect={false} accessibilityLabel={t("native.pair.device")}
       placeholder={t("native.pair.deviceExample")} style={styles.field}/>
     {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
     <Pressable accessibilityRole="button" disabled={busy||!code.trim()||!deviceName.trim()||!publicApi}
       onPress={()=>void redeem()} style={[styles.button,(busy||!code.trim()||!deviceName.trim())&&styles.disabled]}>
       <Text style={styles.buttonText}>{busy?t("native.session.checking"):t("native.pair.connect")}</Text>
     </Pressable>
   </View>
 </Screen>;
}
const styles=StyleSheet.create({
 note:{color:theme.colors.muted,fontSize:16},
 panel:{backgroundColor:theme.colors.card,padding:20,borderRadius:20,gap:11},
 switcher:{flexDirection:"row",gap:10},
 lang:{backgroundColor:theme.colors.card,padding:12,borderRadius:12},
 langSelected:{backgroundColor:theme.colors.accent},
 langText:{color:theme.colors.ink,fontWeight:"700"},
 langTextSelected:{color:"#FFFFFF",fontWeight:"700"},
 label:{color:theme.colors.ink,fontSize:15,fontWeight:"800"},
 field:{borderWidth:1,borderColor:theme.colors.outline,borderRadius:14,
   padding:14,fontSize:17,color:theme.colors.ink,backgroundColor:theme.colors.background},
 button:{backgroundColor:theme.colors.accent,padding:16,borderRadius:15,alignItems:"center"},
 buttonText:{color:"#FFFFFF",fontWeight:"800",fontSize:16},
 disabled:{opacity:0.5},
 outline:{borderWidth:2,borderColor:theme.colors.accent,borderRadius:15,padding:16},
 outlineText:{textAlign:"center",color:theme.colors.accent,fontWeight:"800"},
 parentUrl:{textAlign:"center",marginTop:10,color:theme.colors.ink,fontSize:13},
 error:{color:theme.colors.error,fontSize:14}
});
