import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ApiError, type NativePairStart } from "@quizdip/api-client";
import { Screen } from "../src/components/Screen";
import { useKidsLocale } from "../src/state/locale";
import { useKidsSession } from "../src/state/session";
import { kidsApi, publicApi } from "../src/services/api";
import { theme } from "../src/theme";

export default function SetupScreen(){
 const session=useKidsSession();
 const {locale}=useKidsLocale();
 const ko=locale==="ko";
 const [request,setRequest]=useState<NativePairStart|null>(null);
 const [error,setError]=useState("");
 const [renew,setRenew]=useState(0);
 const [expired,setExpired]=useState(false);

 useEffect(()=>{
   if(session.status!=="unpaired"||!kidsApi)return;
   let cancelled=false;
   setRequest(null);setError("");setExpired(false);
   void kidsApi.beginPair(Platform.OS==="ios"?"Kids iPad":"Kids device")
     .then(next=>{if(!cancelled)setRequest(next);})
     .catch(()=>{if(!cancelled)setError(ko?"연결 코드를 만들 수 없어요. 다시 시도해 주세요.":"Could not create a connection. Try again.");});
   return ()=>{cancelled=true;};
 },[session.status,renew]);

 useEffect(()=>{
   if(!request || session.status!=="unpaired")return;
   let stopped=false,inFlight=false;
   const poll=async()=>{
     if(stopped||inFlight)return;
     if(Date.now()>=Date.parse(request.expiresAt)){
       setExpired(true);return;
     }
     inFlight=true;
     try{
       await session.claimPair(request.deviceSecret);
     }catch(e){
       if(e instanceof ApiError && ["pair_expired","pair_claimed"].includes(e.code))setExpired(true);
       else setError(ko?"연결을 확인하지 못했어요. 다시 시도해 주세요.":"Could not confirm the connection. Try again.");
     }finally{inFlight=false;}
   };
   const timer=setInterval(()=>void poll(),3000);
   return ()=>{stopped=true;clearInterval(timer);};
 },[request,session.status,session.claimPair,ko]);

 if(session.status==="active")return <Redirect href="/" />;
 if(session.status==="checking")return <Screen title="QuizDip Kids">
   <ActivityIndicator size="large" color={theme.colors.accent}/>
 </Screen>;
 if(session.status==="unavailable")return <Screen title={ko?"연결할 수 없어요":"Connection unavailable"}>
   <Pressable accessibilityRole="button" style={styles.button} onPress={()=>void session.reload()}>
     <Text style={styles.buttonText}>{ko?"다시 시도":"Try again"}</Text>
   </Pressable>
 </Screen>;

 const link=request?publicApi.origin+"/"+locale+"/account/kids/connect?token="+encodeURIComponent(request.qrToken):"";
 return <Screen title={ko?"부모님과 연결하기":"Connect with a parent"}
   subtitle={ko?"부모님 휴대폰으로 연결해 주세요.":"Ask a parent to connect your device."}>
   <View style={styles.panel}>
     <Text style={styles.heading}>{ko?"부모님 휴대폰으로 QR을 스캔해 주세요":"Scan this QR with a parent's phone"}</Text>
     {!request&&!error?<ActivityIndicator size="large" color={theme.colors.accent}/>:null}
     {request&&!expired?<View style={styles.qr}>
       <QRCode value={link} size={210} ecl="M" backgroundColor="#FFFFFF" color="#111111"/>
     </View>:null}
     {request&&!expired?<Text style={styles.note}>{ko?"부모님이 로그인하고 연결을 승인하면 자동으로 시작해요.":"Sign in and approve on the parent's phone. This iPad connects automatically."}</Text>:null}
     {request&&!expired?<View style={styles.fallback}>
       <Text style={styles.label}>{ko?"QR이 어렵다면 이 6자리 코드를 사용하세요":"Or enter this six-digit code on the parent's phone"}</Text>
       <Text style={styles.code} selectable accessibilityLabel={request.shortCode}>
         {request.shortCode.slice(0,3)+" "+request.shortCode.slice(3)}
       </Text>
       <Text style={styles.url} selectable>{publicApi.origin+"/"+locale+"/account/kids"}</Text>
       <Text style={styles.note}>{ko?"코드는 5분 후 만료돼요.":"Code expires in 5 minutes."}</Text>
     </View>:null}
     {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
     {expired?<Text accessibilityRole="alert" style={styles.error}>{ko?"코드가 만료됐어요. 새로 발급해 주세요.":"Code expired. Generate a new one."}</Text>:null}
     <Pressable accessibilityRole="button" style={styles.button}
       onPress={()=>setRenew(n=>n+1)}>
       <Text style={styles.buttonText}>{ko?"새 QR·코드 받기":"Get a new QR and code"}</Text>
     </Pressable>
   </View>
 </Screen>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:theme.colors.card,padding:20,borderRadius:20,alignItems:"center",gap:14},
 heading:{color:theme.colors.ink,fontSize:19,fontWeight:"800",textAlign:"center"},
 qr:{padding:16,backgroundColor:"#FFFFFF",borderRadius:16},
 note:{color:theme.colors.muted,fontSize:14,textAlign:"center"},
 fallback:{borderTopWidth:1,borderColor:theme.colors.outline,alignItems:"center",paddingTop:16,gap:9,width:"100%"},
 label:{color:theme.colors.ink,fontWeight:"700",fontSize:15,textAlign:"center"},
 code:{color:theme.colors.accent,fontSize:38,fontWeight:"900",letterSpacing:4},
 url:{color:theme.colors.ink,fontSize:13,textAlign:"center"},
 button:{backgroundColor:theme.colors.accent,padding:16,borderRadius:15,alignItems:"center",width:"100%"},
 buttonText:{color:"#FFFFFF",fontWeight:"800",fontSize:16},
 error:{color:theme.colors.error,fontSize:14,textAlign:"center"}
});
