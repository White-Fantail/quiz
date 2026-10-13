import { useEffect,useId,useState } from "react";
import { ActivityIndicator,Platform,Pressable,StyleSheet,Text,View } from "react-native";
import Svg,{Circle,Defs,Mask,Rect} from "react-native-svg";
import { Image } from "expo-image";
import { useAudioPlayer } from "expo-audio";
import { VideoView,useVideoPlayer } from "expo-video";
import type { KidClue,KidPlayMedia,ImageRevealSettings } from "@quizdip/api-client";
import { kidsApi } from "../services/api";
import { useKidsLocale } from "../state/locale";
import { theme } from "../theme";
import { nativeRevealBlurRadius } from "./reveal-blur";

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
function NativeImageReveal({url,reveal,label}:{url:string;reveal:ImageRevealSettings;label:string}){
  const maskId=useId().replace(/:/g,"_");
  const [layout,setLayout]=useState({width:320,height:240});
  const strength=Number.isFinite(reveal.strength)?Math.max(0,Math.min(100,reveal.strength)):100;
  const blurRadius=reveal.effect==="blur" ? nativeRevealBlurRadius(strength,Platform.OS) : 0;
  const x=Math.max(0,Math.min(100,reveal.focusX??50));
  const y=Math.max(0,Math.min(100,reveal.focusY??50));
  const zoom=1+strength*0.03;
  const radius=Math.max(10,(100-strength*0.9)*Math.max(layout.width,layout.height)*0.014);
  return <View style={styles.imageWindow} onLayout={event=>{
    const {width,height}=event.nativeEvent.layout;
    if(width>0&&height>0&&Math.abs(width-layout.width)>1)setLayout({width,height});
  }}>
    <Image key={`${reveal.effect}:${blurRadius}`} source={{uri:url}} accessibilityLabel={label} contentFit="contain"
      blurRadius={blurRadius}
      style={[styles.revealImage,reveal.effect==="zoom"?{
        transform:[{translateX:(50-x)/100*layout.width*(zoom-1)},
          {translateY:(50-y)/100*layout.height*(zoom-1)},{scale:zoom}]
      }:undefined]}/>
    {reveal.effect==="spotlight" && strength>0?<Svg width="100%" height="100%"
      viewBox={`0 0 ${layout.width} ${layout.height}`} style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs><Mask id={maskId}>
        <Rect width={layout.width} height={layout.height} fill="white"/>
        <Circle cx={x/100*layout.width} cy={y/100*layout.height} r={radius} fill="black"/>
      </Mask></Defs>
      <Rect width={layout.width} height={layout.height} fill="#15243b" mask={`url(#${maskId})`}/>
    </Svg>:null}
  </View>;
}
export function SafeKidMedia({token,sessionId,sessionToken,mediaId,reveal}:{
  token:string;sessionId:string;sessionToken:string;mediaId:string;reveal?:ImageRevealSettings
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
    {media.kind==="image"?(reveal ?
       <NativeImageReveal url={media.url} reveal={reveal} label={t("native.media.image")}/> :
       <Image source={{uri:media.url}} contentFit="contain"
         style={styles.image} accessibilityLabel={t("native.media.image")}/>):
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
    {["image","image-reveal","audio","video"].includes(clue.type)&&clue.mediaId?
      <SafeKidMedia token={token} sessionId={sessionId} sessionToken={sessionToken} mediaId={clue.mediaId}
        reveal={clue.type==="image-reveal"?clue.reveal:undefined}/>:
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
 imageWindow:{width:"100%",height:240,borderRadius:14,backgroundColor:"#15243b",overflow:"hidden"},
 revealImage:{width:"100%",height:"100%"},
 video:{width:"100%",height:250,backgroundColor:"#161622",borderRadius:12},
 play:{backgroundColor:theme.colors.sky,padding:18,borderRadius:14,alignItems:"center"},
 playText:{fontSize:27,fontWeight:"800",color:theme.colors.ink},
 map:{backgroundColor:theme.colors.mint,padding:18,alignItems:"center",borderRadius:14},
 pin:{fontSize:32},coord:{fontSize:17,fontWeight:"700",color:theme.colors.ink}
});
