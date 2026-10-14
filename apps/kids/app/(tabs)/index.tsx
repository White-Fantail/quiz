import { ActivityIndicator,  ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useKidsNavigation } from "../../src/useKidsNavigation";
import { Screen } from "../../src/components/Screen";
import { KidsTap } from "../../src/components/KidsTap";
import { AdventureTile } from "../../src/components/AdventureTile";
import { AdventureArtwork } from "../../src/components/AdventureArtwork";
import { KidsEmojiIcon } from "../../src/components/KidsIcon";
import { adventures, adventureCount, adventureForPack, adventureForQuiz } from "../../src/adventures";
import { useKidsAdventures } from "../../src/useKidsAdventures";
import { useKidsLocale } from "../../src/state/locale";
import { useKidsSession } from "../../src/state/session";
import { theme } from "../../src/theme";

export default function KidsHome(){
 const go=useKidsNavigation(),{width}=useWindowDimensions();
 const {t}=useKidsLocale();
 const kid=useKidsSession();
 const nickname=kid.status==="active"?kid.session.profile.nickname.trim():"";
 const {packs,quizzes,featured,loading,loaded,error,reload}=useKidsAdventures();
 const heroPick=featured.find(item=>item.type==="PACK")||featured[0];
 const hero=heroPick?
   {id:heroPick.id,title:heroPick.headline||heroPick.title,description:heroPick.description,
    count:heroPick.questionCount,type:heroPick.type,
    adventure:heroPick.type==="PACK"?adventureForPack(heroPick):adventureForQuiz({
      title:heroPick.title,prompt:heroPick.description,answerType:"other"
    })}:
   packs[0]?{id:packs[0].id,title:packs[0].title,description:packs[0].description,
    count:packs[0].questionCount,type:"PACK" as const,adventure:adventureForPack(packs[0])}:
   quizzes[0]?{id:quizzes[0].id,title:quizzes[0].title,description:quizzes[0].prompt,
    count:1,type:"QUIZ" as const,adventure:adventureForQuiz(quizzes[0])}:null;
 const available=adventures.filter(item=>adventureCount(item.id,packs,quizzes)>0);
 const openGame=(id:string,type:"PACK"|"QUIZ")=>go(type==="PACK"?
   {pathname:"/game",params:{packId:id}}:{pathname:"/game",params:{quizId:id}});
 const columns=width>=720?2:1;
 return <Screen title={nickname?t("native.home.hello")+", "+nickname+"!":t("kids.welcome")}
   subtitle={t("native.adventure.homeLead")}
   headerAction={<KidsTap accessibilityRole="button"
     accessibilityLabel={t("native.guardian.open")}
     accessibilityHint={t("native.guardian.detail")}
     onPress={()=>router.push("/parent")} style={styles.parentsButton}>
     <Text style={styles.parentsText}>{t("native.guardian.open")}</Text>
   </KidsTap>}>
   {hero?<KidsTap accessibilityRole="button"
      accessibilityLabel={hero.title+". "+t("native.adventure.play")}
      onPress={()=>openGame(hero.id,hero.type)}
      style={({pressed})=>[styles.hero,{opacity:pressed?.85:1}]}>
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>{heroPick?t("native.adventure.pickForYou"):t("native.adventure.startHere")}</Text>
        <Text numberOfLines={2} style={styles.heroTitle}>{hero.title}</Text>
        <Text numberOfLines={2} style={styles.heroDesc}>{hero.description}</Text>
        <View style={styles.heroButton}><Text style={styles.heroButtonText}>{t("native.adventure.play")}</Text></View>
      </View>
      <View pointerEvents="none" style={styles.heroArt}><AdventureArtwork id={hero.adventure} size={width>=720?200:151}/></View>
   </KidsTap>:null}
   {loading&&!loaded?<View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.accent}/>
      <Text style={styles.muted}>{t("native.adventure.loading")}</Text></View>:null}
   {error?<KidsTap accessibilityRole="button" onPress={reload} style={styles.notice}>
      <Text style={styles.noticeText}>{t("native.adventure.error")}  {t("native.adventure.retry")} ↻</Text>
   </KidsTap>:null}
   {loaded&&available.length===0&&!loading?<View style={styles.empty}>
     <KidsEmojiIcon emoji="✨" size={42} color={theme.colors.accent}/>
     <Text style={styles.emptyText}>{t("native.adventure.empty")}</Text>
     <KidsTap accessibilityRole="button" onPress={reload}><Text style={styles.link}>{t("native.adventure.retry")} ↻</Text></KidsTap>
   </View>:null}
   {available.length>0?<View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.heading}>{t("native.adventure.choose")}</Text>
        <KidsTap accessibilityRole="button" onPress={()=>router.push("/explore")}>
          <Text style={styles.link}>{t("native.adventure.all")} →</Text>
        </KidsTap>
      </View>
      <View style={styles.grid}>
       {available.map(item=><View key={item.id} style={{width:columns===2?"48.8%":"100%"}}>
         <AdventureTile id={item.id} emoji={item.emoji} title={t(item.labelKey)} detail={t(item.detailKey)}
          count={adventureCount(item.id,packs,quizzes)} playLabel={t("native.adventure.toPlay")}
          tint={item.tint} onPress={()=>router.push({pathname:"/explore",params:{adventure:item.id}})}/>
       </View>)}
      </View>
   </View>:null}
   {packs.length>0?<View style={styles.section}>
     <View style={styles.sectionHeader}>
       <Text style={styles.heading}>{t("native.adventure.ready")}</Text>
       <KidsTap accessibilityRole="button" onPress={()=>router.push("/explore")}><Text style={styles.link}>{t("native.adventure.all")} →</Text></KidsTap>
     </View>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packList}>
       {packs.slice(0,8).map(pack=><KidsTap key={pack.id} accessibilityRole="button"
         accessibilityLabel={pack.title} onPress={()=>openGame(pack.id,"PACK")}
         style={styles.packCard}>
         <View style={styles.packArt}><AdventureArtwork id={adventureForPack(pack)} size={90}/></View>
         <Text style={styles.packTitle} numberOfLines={2}>{pack.title}</Text>
         <Text style={styles.packMeta}>{pack.questionCount} {t("native.adventure.questions")}  ·  ▶</Text>
       </KidsTap>)}
     </ScrollView>
   </View>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 parentsButton:{minHeight:44,borderRadius:17,borderWidth:1,borderColor:theme.colors.outline,
   backgroundColor:"#FFFFFF",paddingHorizontal:15,justifyContent:"center",alignItems:"center"},
 parentsText:{color:theme.colors.accent,fontWeight:"800",fontSize:14},
 hero:{backgroundColor:"#6D48D9",borderRadius:30,minHeight:226,overflow:"hidden",padding:25,
   flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 heroCopy:{flex:1,gap:9,zIndex:1,maxWidth:"68%"},
 eyebrow:{color:"#FCE790",fontWeight:"900",fontSize:13,letterSpacing:1},
 heroTitle:{color:"#FFFFFF",fontWeight:"900",fontSize:28,lineHeight:32},
 heroDesc:{color:"#F0E9FF",fontWeight:"600",fontSize:14,lineHeight:20},
 heroButton:{alignSelf:"flex-start",backgroundColor:"#FFDB76",borderRadius:24,paddingVertical:10,paddingHorizontal:20,marginTop:8},
 heroButtonText:{fontWeight:"900",color:"#352052",fontSize:15},
 heroArt:{position:"absolute",right:1,bottom:0,opacity:1},
 section:{gap:14},
 sectionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink,flexShrink:1},
 link:{fontSize:14,fontWeight:"900",color:theme.colors.accent},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:14},
 loading:{alignItems:"center",padding:28,gap:14},
 muted:{color:theme.colors.muted,fontSize:15},
 empty:{alignItems:"center",backgroundColor:"#EFE9FF",padding:25,borderRadius:24,gap:12},
 emptyText:{textAlign:"center",fontSize:17,color:theme.colors.ink,fontWeight:"700"},
 notice:{padding:14,borderRadius:14,backgroundColor:"#FFF1DD"},
 noticeText:{color:theme.colors.ink,fontWeight:"700",fontSize:14},
 packList:{gap:13,paddingBottom:5},
 packCard:{width:187,minHeight:174,borderRadius:22,padding:15,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:theme.colors.outline,gap:6},
 packArt:{alignSelf:"center",height:95,marginTop:-8},
 packTitle:{color:theme.colors.ink,fontSize:16,fontWeight:"900",lineHeight:20},
 packMeta:{fontSize:13,color:theme.colors.accent,fontWeight:"800"},
});
