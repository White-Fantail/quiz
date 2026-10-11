import { useEffect,useState } from "react";
import { ActivityIndicator,Pressable,StyleSheet,Text,View } from "react-native";
import { Image } from "expo-image";
import { useAudioPlayer } from "expo-audio";
import { VideoView,useVideoPlayer } from "expo-video";
import type { KidClue,KidPlayMedia } from "@quizdip/api-client";
import { kidsApi } from "../services/api";
import { useKidsLocale } from "../state/locale";
import { theme } from "../theme";

function AudioPlayer({url}:{url:string}){
  const player=useAudioPlayer(url);
  return <Pressable accessibilityRole="button" style={styles.play} onPress={()=>{void player.seekTo(0);player.play();}}>
    <Text style={styles.playText}>🔊 ▶</Text>
  </Pressable>;
}
function VideoPlayer({url}:{url:string}){
  const player=useVideoPlayer(url);
  return <VideoView player={player} nativeControls contentFit="contain" style={styles.video}
    fullscreenOptions={{enable:false}} allowsPictureInPicture={false}/>;
}
export function SafeKidMedia({token,sessionId,sessionToken,mediaId}:{
  token:string;sessionId:string;sessionToken:string;mediaId:string
}){
  const [media,setMedia]=useState<KidPlayMedia|null>(null);
  const [state,setState]=useState<"loading"|"error"|"ready">("loading");
  const [retry,setRetry]=useState(0),{t}=useKidsLocale();
  useEffect(()=>{
    let live=true;
    setMedia(null);setState("loading");
    if(!kidsApi){setState("error");return;}
    void kidsApi.playMedia(token,sessionId,sessionToken,mediaId).then(result=>{
      if(live){setMedia(result);setState("ready");}
    }).catch(()=>{if(live)setState("error");});
    return ()=>{live=false;};
  },[token,sessionId,sessionToken,mediaId,retry]);
  if(state==="loading")return <ActivityIndicator color={theme.colors.accent}/>;
  if(state==="error"||!media)return <Pressable accessibilityRole="button"
    onPress={()=>setRetry(x=>x+1)} style={styles.play}><Text>{t("native.media.retry")}</Text></Pressable>;
  return <View style={styles.media}>
    {media.kind==="image"?<Image source={{uri:media.url}} contentFit="contain"
       style={styles.image} accessibilityLabel={t("native.media.image")}/>:
     media.kind==="audio"?<AudioPlayer key={media.url} url={media.url}/>:
     media.kind==="video"?<VideoPlayer key={media.url} url={media.url}/>:null}
  </View>;
}
export function KidClueView({clue,token,sessionId,sessionToken}:{
  clue:KidClue;token:string;sessionId:string;sessionToken:string
}){
  const {t}=useKidsLocale();
  return <View style={styles.clue}>
    {clue.text?<Text style={styles.description}>{clue.text}</Text>:null}
    {["image","audio","video"].includes(clue.type)&&clue.mediaId?
      <SafeKidMedia token={token} sessionId={sessionId} sessionToken={sessionToken} mediaId={clue.mediaId}/>:
     clue.type==="map" && clue.map?<View style={styles.map}>
       <Text style={styles.pin}>📍</Text>
       <Text style={styles.description}>{t("native.media.map")}</Text>
       <Text style={styles.coord}>{clue.map.latitude.toFixed(2)}°, {clue.map.longitude.toFixed(2)}°</Text>
     </View>:null}
  </View>;
}
const styles=StyleSheet.create({
 clue:{backgroundColor:theme.colors.card,borderRadius:20,padding:18,gap:12},
 description:{fontSize:18,lineHeight:26,color:theme.colors.ink},
 media:{gap:8},image:{width:"100%",height:240,borderRadius:14},
 video:{width:"100%",height:250,backgroundColor:"#161622",borderRadius:12},
 play:{backgroundColor:theme.colors.sky,padding:18,borderRadius:14,alignItems:"center"},
 playText:{fontSize:27,fontWeight:"800",color:theme.colors.ink},
 map:{backgroundColor:theme.colors.mint,padding:18,alignItems:"center",borderRadius:14},
 pin:{fontSize:32},coord:{fontSize:17,fontWeight:"700",color:theme.colors.ink}
});
