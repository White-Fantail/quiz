import {useCallback,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {useFocusEffect,useRouter} from "expo-router";
import * as SecureStore from "expo-secure-store";
import {Screen} from "../../src/components/Screen";
import {KidsEmojiIcon} from "../../src/components/KidsIcon";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {adventureForPack,adventureById} from "../../src/adventures";
import {useKidsAdventures} from "../../src/useKidsAdventures";
import {useKidsLocale} from "../../src/state/locale";
import {theme} from "../../src/theme";

const SAVED_GAME="quizdip-kids-active-game-v1";

export default function ChallengeScreen(){
 const {t}=useKidsLocale(),router=useRouter(),{width}=useWindowDimensions();
 const {packs,loading,error,reload}=useKidsAdventures();
 const [canResume,setCanResume]=useState(false);
 useFocusEffect(useCallback(()=>{
   let live=true;
   void SecureStore.getItemAsync(SAVED_GAME).then(raw=>{
     if(!live)return;
     try{
       const value=raw?JSON.parse(raw):null;
       setCanResume((value?.kind==="single"||value?.kind==="run")&&
          typeof value?.[value.kind==="single"?"sessionToken":"runToken"]==="string");
     }catch{setCanResume(false);}
   }).catch(()=>{if(live)setCanResume(false);});
   return ()=>{live=false;};
 },[]));
 const ready=packs.slice(0,4);
 const wide=width>=720;
 return <Screen title={t("kids.challenge.title")} subtitle={t("native.challenge.lead")}>
   <Pressable accessibilityRole="button" accessibilityLabel={t("native.play.fiveTitle")}
      onPress={()=>router.push({pathname:"/game",params:{mode:"RANDOM_FIVE"}})}
      style={({pressed})=>[styles.hero,{opacity:pressed?0.87:1}]}>
     <View style={styles.heroCopy}>
       <Text style={styles.eyebrow}>{t("native.challenge.surpriseLabel")}</Text>
       <Text style={styles.heroTitle}>{t("native.play.fiveTitle")}</Text>
       <Text style={styles.heroDetail}>{t("native.play.fiveDesc")}</Text>
       <View style={styles.heroButton}>
         <KidsEmojiIcon emoji="🎲" size={20} color={theme.colors.ink}/>
         <Text style={styles.heroButtonText}>{t("native.challenge.start")}</Text>
       </View>
     </View>
     <View pointerEvents="none" style={styles.heroArt}>
       <AdventureArtwork id="surprise" size={wide?208:146}/>
     </View>
   </Pressable>

   {canResume?<Pressable accessibilityRole="button" onPress={()=>router.push("/game")}
     style={({pressed})=>[styles.resume,{opacity:pressed?.8:1}]}>
      <View style={styles.resumeIcon}><KidsEmojiIcon emoji="▶" size={25} color={theme.colors.accent}/></View>
      <View style={{flex:1,gap:4}}>
        <Text style={styles.resumeTitle}>{t("native.play.resume")}</Text>
        <Text style={styles.resumeDetail}>{t("native.challenge.resumeDetail")}</Text>
      </View>
      <Text style={styles.rightArrow}>→</Text>
   </Pressable>:null}

   <View style={styles.section}>
     <View style={styles.headingRow}>
       <View style={{flex:1,gap:4}}>
         <Text style={styles.heading}>{t("native.challenge.packHeading")}</Text>
         <Text style={styles.subheading}>{t("native.challenge.packLead")}</Text>
       </View>
       <Pressable accessibilityRole="button" onPress={()=>router.push("/explore")}
         style={styles.browse}><Text style={styles.browseText}>{t("native.adventure.all")} →</Text></Pressable>
     </View>
     {loading&&ready.length===0?<ActivityIndicator color={theme.colors.accent}/>:null}
     {error?<Pressable accessibilityRole="button" onPress={reload} style={styles.notice}>
       <Text style={styles.noticeText}>{t("native.adventure.error")} {t("native.adventure.retry")} ↻</Text>
     </Pressable>:null}
     <View style={styles.grid}>
       {ready.map(pack=>{
         const adventure=adventureForPack(pack);
         return <Pressable key={pack.id} accessibilityRole="button" accessibilityLabel={pack.title}
           onPress={()=>router.push({pathname:"/game",params:{packId:pack.id}})}
           style={({pressed})=>[styles.packCard,{width:wide?"48.8%":"100%",opacity:pressed?.83:1}]}>
           <View style={[styles.packArt,{backgroundColor:adventureById(adventure)?.tint||theme.colors.lilac}]}>
              <AdventureArtwork id={adventure} size={104}/>
           </View>
           <View style={styles.packCopy}>
              <Text numberOfLines={2} style={styles.packTitle}>{pack.title}</Text>
              <Text style={styles.packCount}>{pack.questionCount} {t("native.adventure.questions")}</Text>
              <Text style={styles.packStart}>{t("native.challenge.start")} →</Text>
           </View>
         </Pressable>;
       })}
     </View>
     {ready.length===0&&!loading?<Pressable accessibilityRole="button" onPress={()=>router.push("/explore")}
       style={styles.exploreBox}>
        <View style={styles.exploreArt}><AdventureArtwork id="dinosaur" size={116}/></View>
        <View style={{flex:1,gap:8}}>
          <Text style={styles.exploreTitle}>{t("native.challenge.exploreTitle")}</Text>
          <Text style={styles.exploreDetail}>{t("native.challenge.exploreDetail")}</Text>
          <Text style={styles.packStart}>{t("native.adventure.findMore")} →</Text>
        </View>
       </Pressable>:null}
   </View>
 </Screen>;
}
const styles=StyleSheet.create({
 hero:{minHeight:266,borderRadius:30,padding:25,backgroundColor:"#7248D9",overflow:"hidden",
   flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 heroCopy:{flex:1,maxWidth:"70%",zIndex:1,gap:10},
 eyebrow:{fontSize:13,fontWeight:"900",letterSpacing:1.1,color:"#FFE497"},
 heroTitle:{fontSize:29,lineHeight:35,fontWeight:"900",color:"#FFFFFF"},
 heroDetail:{fontSize:15,lineHeight:22,fontWeight:"600",color:"#F4EDFF"},
 heroButton:{marginTop:8,alignSelf:"flex-start",backgroundColor:"#FFDA77",
   paddingHorizontal:18,paddingVertical:12,borderRadius:22,flexDirection:"row",alignItems:"center",gap:10},
 heroButtonText:{color:theme.colors.ink,fontWeight:"900",fontSize:16},
 heroArt:{position:"absolute",right:-5,bottom:8},
 resume:{backgroundColor:"#D6F5E9",borderRadius:23,padding:16,flexDirection:"row",
   alignItems:"center",gap:13,minHeight:90},
 resumeIcon:{backgroundColor:"#FFFFFF",width:53,height:53,borderRadius:17,alignItems:"center",justifyContent:"center"},
 resumeTitle:{fontSize:18,fontWeight:"900",color:theme.colors.ink},
 resumeDetail:{fontSize:13,color:theme.colors.muted,fontWeight:"600"},
 rightArrow:{fontSize:24,fontWeight:"900",color:theme.colors.accent},
 section:{gap:15},
 headingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:15},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 subheading:{fontSize:14,lineHeight:19,color:theme.colors.muted,fontWeight:"600"},
 browse:{minHeight:44,padding:10,justifyContent:"center"},
 browseText:{color:theme.colors.accent,fontWeight:"900",fontSize:14},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:13},
 packCard:{minHeight:152,backgroundColor:"#FFFFFF",borderRadius:23,
    borderColor:theme.colors.outline,borderWidth:1,flexDirection:"row",overflow:"hidden"},
 packArt:{width:"38%",justifyContent:"center",alignItems:"center"},
 packCopy:{flex:1,padding:15,justifyContent:"space-around",gap:6},
 packTitle:{fontSize:18,fontWeight:"900",color:theme.colors.ink,lineHeight:23},
 packCount:{color:theme.colors.muted,fontSize:13,fontWeight:"700"},
 packStart:{color:theme.colors.accent,fontWeight:"900",fontSize:14},
 exploreBox:{borderRadius:25,backgroundColor:"#E9DEFF",minHeight:162,flexDirection:"row",gap:12,
   padding:18,alignItems:"center"},
 exploreArt:{width:125,alignItems:"center"},
 exploreTitle:{fontSize:19,fontWeight:"900",color:theme.colors.ink},
 exploreDetail:{fontSize:14,lineHeight:21,color:theme.colors.muted},
 notice:{backgroundColor:"#FFF1DD",borderRadius:16,padding:14},
 noticeText:{fontSize:14,fontWeight:"700",color:theme.colors.ink},
});
