import {ActivityIndicator,StyleSheet,Text,View} from "react-native";
import {useLocalSearchParams,useRouter} from "expo-router";
import {Screen} from "../../src/components/Screen";
import {BrowseBack} from "../../src/components/BrowseBack";
import {KidsTap} from "../../src/components/KidsTap";
import {KidsPackCard,packGrid} from "../../src/components/KidsPackCard";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {adventureById,adventureForPack} from "../../src/adventures";
import {useKidsPackBrowse} from "../../src/useKidsPackBrowse";
import {useKidsNavigation} from "../../src/useKidsNavigation";
import {useKidsLocale} from "../../src/state/locale";
import {theme} from "../../src/theme";
export default function KidsWorld(){
 const {id,from}=useLocalSearchParams<{id?:string;from?:string}>();
 const router=useRouter(),go=useKidsNavigation(),{t}=useKidsLocale(),item=adventureById(id);
 const {packs,loading,loaded,error,reload}=useKidsPackBrowse();
 const matched=item?packs.filter(pack=>adventureForPack(pack)===item.id):[];
 const back=()=>router.replace(from==="worlds"?"/worlds":"/");
 return <Screen title={item?t(item.labelKey):t("native.browse.worlds")}
   subtitle={item?t("native.browse.worldLead"):t("native.adventure.emptyWorld")}>
   <BrowseBack onPress={back}/>
   {item?<View style={[styles.intro,{backgroundColor:item.tint}]}>
      <AdventureArtwork id={item.id} size={101}/>
      <Text style={styles.introText}>{t(item.detailKey)}</Text>
   </View>:null}
   <Text style={styles.heading}>{t("native.adventure.packs")}</Text>
   {loading&&!loaded?<ActivityIndicator size="large" color={theme.colors.accent}/>:null}
   {error?<KidsTap accessibilityRole="button" onPress={reload} style={styles.notice}>
     <Text style={styles.retry}>{t("native.adventure.retry")} ↻</Text>
   </KidsTap>:null}
   <View style={packGrid}>
      {matched.map(pack=><KidsPackCard key={pack.id} pack={pack}/>)}
   </View>
   {loaded&&!loading&&matched.length===0?<Text style={styles.empty}>{t("native.adventure.emptyWorld")}</Text>:null}
   <KidsTap accessibilityRole="button" onPress={()=>go({pathname:"/all-packs",params:{from:"world",id:item?.id??"",backTo:from==="worlds"?"worlds":"home"}})} style={styles.all}>
     <Text style={styles.retry}>{t("native.browse.allPacks")} →</Text>
   </KidsTap>
 </Screen>;
}
const styles=StyleSheet.create({
 intro:{borderRadius:24,minHeight:122,padding:13,flexDirection:"row",
   alignItems:"center",gap:13},
 introText:{fontSize:17,fontWeight:"800",color:theme.colors.ink,flex:1},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 notice:{padding:14,borderRadius:15,backgroundColor:"#FFF1DD"},
 retry:{fontSize:15,fontWeight:"900",color:theme.colors.accent},
 empty:{fontSize:15,fontWeight:"700",color:theme.colors.muted},
 all:{padding:16,borderRadius:19,backgroundColor:theme.colors.lilac,alignItems:"center"},
});
