import {useEffect,useState} from "react";
import {useLocalSearchParams} from "expo-router";
import {useKidsNavigation} from "../../src/useKidsNavigation";
import {ActivityIndicator,ScrollView,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {Screen} from "../../src/components/Screen";
import {KidsTap} from "../../src/components/KidsTap";
import {KidsEmojiIcon} from "../../src/components/KidsIcon";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {adventures,adventureById,adventureForPack,adventureForQuiz,type AdventureId} from "../../src/adventures";
import {useKidsAdventures} from "../../src/useKidsAdventures";
import {useKidsLocale} from "../../src/state/locale";
import {theme} from "../../src/theme";

type Selection=AdventureId|"all";
export default function ExploreScreen(){
 const go=useKidsNavigation(),{width}=useWindowDimensions();
 const {adventure:routeAdventure}=useLocalSearchParams<{adventure?:string}>();
 const {t}=useKidsLocale();
 const [selected,setSelected]=useState<Selection>(()=>adventureById(routeAdventure)?.id||"all");
 const {packs,quizzes,loading,error,loaded,hasMore,loadMore,reload}=useKidsAdventures();
 useEffect(()=>{setSelected(adventureById(routeAdventure)?.id||"all");},[routeAdventure]);
 const shownPacks=packs.filter(pack=>selected==="all"||adventureForPack(pack)===selected);
 const shownQuizzes=quizzes.filter(quiz=>selected==="all"||adventureForQuiz(quiz)===selected);
 const choose=(next:Selection)=>setSelected(next);
 const wide=width>=720;
 return <Screen title={t("native.adventure.exploreTitle")} subtitle={t("native.adventure.exploreLead")}>
  <View style={styles.illustratedBanner}>
    <View style={{flex:1,zIndex:1}}>
      <Text style={styles.bannerKicker}>{t("native.adventure.showPacks")}</Text>
      <Text style={styles.bannerTitle}>{t("native.adventure.choose")}</Text>
    </View>
    <View pointerEvents="none" style={styles.bannerArt}><AdventureArtwork id="space" size={130}/></View>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}
    accessibilityLabel={t("kids.explore.filters")}>
    <KidsTap accessibilityRole="button" accessibilityState={{selected:selected==="all"}}
       onPress={()=>choose("all")} style={[styles.category,selected==="all"&&styles.categorySelected]}>
       <View style={styles.categoryArt}><KidsEmojiIcon emoji="✨" size={55} color={theme.colors.accent}/></View>
       <Text numberOfLines={2} style={styles.categoryText}>{t("native.adventure.allWorlds")}</Text>
    </KidsTap>
    {adventures.map(item=><KidsTap key={item.id} accessibilityRole="button"
       accessibilityState={{selected:selected===item.id}} onPress={()=>choose(item.id)}
       style={[styles.category,{backgroundColor:item.tint},selected===item.id&&styles.categorySelected]}>
       <AdventureArtwork id={item.id} size={84}/>
       <Text numberOfLines={2} style={styles.categoryText}>{t(item.labelKey)}</Text>
    </KidsTap>)}
  </ScrollView>
  {selected!=="all"?<View style={styles.selection}>
     <Text style={styles.selectionText}>{t(adventureById(selected)!.labelKey)}</Text>
     <KidsTap accessibilityRole="button" onPress={()=>choose("all")}>
       <Text style={styles.action}>{t("native.adventure.allWorlds")} ×</Text>
     </KidsTap>
   </View>:null}
  {loading&&!loaded?<View style={styles.loading}>
    <ActivityIndicator color={theme.colors.accent} size="large"/>
    <Text style={styles.muted}>{t("native.adventure.loading")}</Text>
   </View>:null}
  {error?<KidsTap accessibilityRole="button" onPress={reload} style={styles.notice}>
    <Text style={styles.noticeText}>{t("native.adventure.error")} {t("native.adventure.retry")} ↻</Text>
   </KidsTap>:null}
  {loaded&&shownPacks.length===0&&shownQuizzes.length===0&&!loading?<View style={styles.empty}>
    <AdventureArtwork id={selected==="all"?"surprise":selected} size={125}/>
    <Text style={styles.emptyText}>{selected==="all"?t("native.adventure.empty"):t("native.adventure.emptyWorld")}</Text>
    {selected!=="all"?<KidsTap accessibilityRole="button" onPress={()=>choose("all")}>
     <Text style={styles.action}>{t("native.adventure.allWorlds")} →</Text>
    </KidsTap>:null}
   </View>:null}
  {shownPacks.length>0?<View style={styles.section}>
     <View style={styles.headingRow}>
       <Text style={styles.heading}>📚 {t("native.adventure.packs")}</Text>
       <Text style={styles.headingHint}>{t("native.adventure.showPacks")}</Text>
     </View>
     <View style={styles.grid}>
       {shownPacks.map(pack=><KidsTap key={pack.id} accessibilityRole="button" accessibilityLabel={pack.title}
         onPress={()=>go({pathname:"/game",params:{packId:pack.id}})}
         style={[styles.packCard,{width:wide?"48.7%":"100%"}]}>
         <View style={[styles.cardArt,{backgroundColor:adventureById(adventureForPack(pack))?.tint||"#ECE2FF"}]}>
           <AdventureArtwork id={adventureForPack(pack)} size={116}/>
         </View>
         <View style={styles.cardCopy}>
           <Text numberOfLines={2} style={styles.cardTitle}>{pack.title}</Text>
           <Text numberOfLines={2} style={styles.cardDetail}>{pack.description}</Text>
           <View style={styles.packFooter}>
             <Text style={styles.packCount}>{pack.questionCount} {t("native.adventure.questions")}</Text>
             <View style={styles.playPill}><Text style={styles.playText}>{t("native.adventure.open")} ▶</Text></View>
           </View>
         </View>
       </KidsTap>)}
     </View>
   </View>:null}
  {shownQuizzes.length>0?<View style={styles.section}>
     <Text style={styles.heading}>✨ {t("native.adventure.quizzes")}</Text>
     <View style={styles.grid}>
       {shownQuizzes.map(quiz=><KidsTap key={quiz.id} accessibilityRole="button" accessibilityLabel={quiz.title}
         onPress={()=>go({pathname:"/game",params:{quizId:quiz.id}})}
         style={[styles.quizCard,{width:wide?"48.7%":"100%"}]}>
         <View style={[styles.quizArt,{backgroundColor:adventureById(adventureForQuiz(quiz))?.tint||"#ECE2FF"}]}>
           <KidsEmojiIcon emoji={adventureById(adventureForQuiz(quiz))?.emoji||"✨"} size={38}/>
         </View>
         <View style={styles.quizCopy}>
           <Text numberOfLines={2} style={styles.quizTitle}>{quiz.title}</Text>
           <Text numberOfLines={2} style={styles.cardDetail}>{quiz.prompt}</Text>
           <Text style={styles.action}>{t("native.adventure.open")} ▶</Text>
         </View>
       </KidsTap>)}
     </View>
   </View>:null}
  {loaded&&hasMore?<KidsTap accessibilityRole="button" disabled={loading} onPress={loadMore}
    style={[styles.moreButton,loading&&styles.disabled]}>
    <Text style={styles.moreText}>{loading?t("native.adventure.loading"):t("native.adventure.more")}</Text>
   </KidsTap>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 illustratedBanner:{backgroundColor:"#7752DE",borderRadius:26,minHeight:139,
  padding:22,flexDirection:"row",alignItems:"center",overflow:"hidden"},
 bannerKicker:{fontSize:12,fontWeight:"900",letterSpacing:1,color:"#FFE498",marginBottom:7},
 bannerTitle:{fontSize:23,fontWeight:"900",color:"#FFFFFF",maxWidth:"72%",lineHeight:29},
 bannerArt:{position:"absolute",right:6,bottom:-8},
 categories:{gap:12,paddingVertical:3,paddingHorizontal:2},
 category:{width:140,minHeight:150,borderRadius:22,backgroundColor:"#ECE2FF",
   padding:10,alignItems:"center",justifyContent:"space-between",borderWidth:3,borderColor:"transparent"},
 categorySelected:{borderColor:theme.colors.accent},
 categoryArt:{height:84,justifyContent:"center"},
 categoryText:{fontSize:15,fontWeight:"900",textAlign:"center",color:theme.colors.ink,lineHeight:19,minHeight:37},
 selection:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:6},
 selectionText:{fontSize:19,fontWeight:"900",color:theme.colors.ink},
 action:{fontSize:14,fontWeight:"900",color:theme.colors.accent,marginTop:5},
 section:{gap:14},
 headingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 heading:{fontSize:22,fontWeight:"900",color:theme.colors.ink},
 headingHint:{fontSize:12,fontWeight:"800",color:theme.colors.accent},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:13},
 packCard:{borderRadius:23,backgroundColor:"#FFFFFF",flexDirection:"row",overflow:"hidden",
   borderColor:theme.colors.outline,borderWidth:1,minHeight:161},
 cardArt:{width:"34%",minHeight:155,justifyContent:"center",alignItems:"center"},
 cardCopy:{flex:1,padding:14,gap:7,justifyContent:"space-between"},
 cardTitle:{fontSize:19,fontWeight:"900",color:theme.colors.ink,lineHeight:23},
 cardDetail:{fontSize:13,color:theme.colors.muted,lineHeight:19,fontWeight:"600"},
 packFooter:{flexDirection:"row",justifyContent:"space-between",gap:6,alignItems:"center",flexWrap:"wrap"},
 packCount:{fontSize:12,fontWeight:"800",color:theme.colors.muted},
 playPill:{paddingHorizontal:12,paddingVertical:8,borderRadius:16,backgroundColor:"#FFDB76"},
 playText:{fontSize:12,fontWeight:"900",color:theme.colors.ink},
 quizCard:{minHeight:130,flexDirection:"row",backgroundColor:"#FFFFFF",borderRadius:23,
   borderWidth:1,borderColor:theme.colors.outline,padding:13,gap:13},
 quizArt:{height:86,width:86,borderRadius:19,alignItems:"center",justifyContent:"center"},
 quizCopy:{flex:1,justifyContent:"space-between",gap:6},
 quizTitle:{fontSize:17,fontWeight:"900",color:theme.colors.ink,lineHeight:21},
 loading:{padding:30,gap:12,alignItems:"center"},
 muted:{fontSize:14,color:theme.colors.muted},
 notice:{backgroundColor:"#FFF1DD",borderRadius:15,padding:14},
 noticeText:{fontSize:14,color:theme.colors.ink,fontWeight:"700"},
 empty:{borderRadius:24,padding:28,backgroundColor:"#F0E7FF",alignItems:"center",gap:8},
 emptyText:{fontSize:16,fontWeight:"700",textAlign:"center",color:theme.colors.ink},
 moreButton:{backgroundColor:theme.colors.lilac,borderRadius:19,padding:17,alignItems:"center"},
 moreText:{fontWeight:"900",fontSize:16,color:theme.colors.accent},
 disabled:{opacity:0.5},
});
