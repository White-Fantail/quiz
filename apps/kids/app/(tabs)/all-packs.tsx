import {ActivityIndicator,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {useLocalSearchParams,useRouter} from "expo-router";
import {Screen} from "../../src/components/Screen";
import {BrowseBack} from "../../src/components/BrowseBack";
import {KidsTap} from "../../src/components/KidsTap";
import {KidsPackCard,packGrid} from "../../src/components/KidsPackCard";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {adventureById,adventureForQuiz} from "../../src/adventures";
import {useKidsPackBrowse} from "../../src/useKidsPackBrowse";
import {useKidsAdventures} from "../../src/useKidsAdventures";
import {useKidsNavigation} from "../../src/useKidsNavigation";
import {useKidsLocale} from "../../src/state/locale";
import {theme} from "../../src/theme";
export default function AllPacks(){
 const router=useRouter(),go=useKidsNavigation(),{t}=useKidsLocale(),{width}=useWindowDimensions();
 const {from,id,backTo}=useLocalSearchParams<{from?:string;id?:string;backTo?:string}>();
 const goBack=()=>{
   if(from==="world"&&adventureById(id)){
     router.replace({pathname:"/world",params:{id:id!,from:backTo==="worlds"?"worlds":"home"}});
   }else router.replace(from==="worlds"?"/worlds":"/");
 };
 const {packs,loaded,loading,error,reload}=useKidsPackBrowse();
 const singles=useKidsAdventures();
 const independent=singles.quizzes.filter(item=>item.inKidsPack===false);
 return <Screen title={t("native.browse.allPacks")} subtitle={t("native.browse.allPacksLead")}>
   <BrowseBack onPress={goBack}/>
   {loading&&!loaded?<ActivityIndicator size="large" color={theme.colors.accent}/>:null}
   {error?<KidsTap accessibilityRole="button" onPress={reload} style={styles.notice}>
     <Text style={styles.link}>{t("native.adventure.retry")} ↻</Text>
   </KidsTap>:null}
   <Text style={styles.heading}>{t("native.adventure.packs")}</Text>
   <View style={packGrid}>
     {packs.map(pack=><KidsPackCard key={pack.id} pack={pack}/>)}
   </View>
   {loaded&&!loading&&packs.length===0?<Text style={styles.muted}>{t("native.adventure.empty")}</Text>:null}
   {independent.length>0?<View style={styles.section}>
     <Text style={styles.heading}>{t("native.adventure.quizzes")}</Text>
     <View style={packGrid}>
       {independent.map(quiz=>{
         const world=adventureForQuiz(quiz);
         return <KidsTap key={quiz.id} accessibilityRole="button" accessibilityLabel={quiz.title}
           onPress={()=>go({pathname:"/game",params:{quizId:quiz.id}})}
           style={[styles.quiz,{width:width>=720?"48.7%":"100%"}]}>
           <View style={[styles.art,{backgroundColor:adventureById(world)?.tint||theme.colors.lilac}]}>
             <AdventureArtwork id={world} size={85}/>
           </View>
           <View style={styles.copy}>
             <Text numberOfLines={2} style={styles.quizTitle}>{quiz.title}</Text>
             <Text style={styles.muted}>{t("native.play.single")}</Text>
             <Text style={styles.link}>{t("native.adventure.open")} ▶</Text>
           </View>
         </KidsTap>;
       })}
     </View>
   </View>:null}
   {singles.loaded&&singles.hasMore?<KidsTap accessibilityRole="button" disabled={singles.loading}
     onPress={singles.loadMore} style={styles.more}>
     <Text style={styles.link}>{singles.loading?t("native.adventure.loading"):t("native.adventure.more")}</Text>
   </KidsTap>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 muted:{fontSize:14,fontWeight:"700",color:theme.colors.muted},
 link:{fontSize:14,fontWeight:"900",color:theme.colors.accent},
 section:{gap:14},
 quiz:{minHeight:140,borderRadius:21,flexDirection:"row",overflow:"hidden",
   backgroundColor:"#FFFFFF",borderWidth:1,borderColor:theme.colors.outline},
 art:{width:"36%",justifyContent:"center",alignItems:"center"},
 copy:{padding:12,flex:1,gap:7,justifyContent:"space-around"},
 quizTitle:{fontWeight:"900",fontSize:17,lineHeight:21,color:theme.colors.ink},
 notice:{padding:14,borderRadius:16,backgroundColor:"#FFF1DD"},
 more:{padding:17,backgroundColor:theme.colors.lilac,borderRadius:19,alignItems:"center"},
});
