import {ActivityIndicator,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {useRouter} from "expo-router";
import {useKidsNavigation} from "../../src/useKidsNavigation";
import {useKidsPackBrowse} from "../../src/useKidsPackBrowse";
import {Screen} from "../../src/components/Screen";
import {BrowseBack} from "../../src/components/BrowseBack";
import {KidsTap} from "../../src/components/KidsTap";
import {AdventureArtwork} from "../../src/components/AdventureArtwork";
import {adventures,adventureCount} from "../../src/adventures";
import {useKidsLocale} from "../../src/state/locale";
import {theme} from "../../src/theme";

export default function AllWorlds(){
 const router=useRouter(),go=useKidsNavigation(),{width}=useWindowDimensions(),{t}=useKidsLocale();
 const {packs,loading,error,loaded,reload}=useKidsPackBrowse();
 const available=adventures.filter(item=>adventureCount(item.id,packs,[])>0);
 return <Screen title={t("native.browse.worlds")} subtitle={t("native.browse.worldsLead")}>
   <BrowseBack onPress={()=>router.replace("/")}/>
   {loading&&!loaded?<ActivityIndicator color={theme.colors.accent} size="large"/>:null}
   {error?<KidsTap accessibilityRole="button" onPress={reload} style={styles.notice}>
      <Text style={styles.link}>{t("native.adventure.retry")} ↻</Text>
   </KidsTap>:null}
   <View style={styles.grid}>
     {available.map(item=><KidsTap key={item.id} accessibilityRole="button" accessibilityLabel={t(item.labelKey)}
       onPress={()=>go({pathname:"/world",params:{id:item.id,from:"worlds"}})}
       style={[styles.tile,{backgroundColor:item.tint,width:width>=720?"31.9%":"48.5%"}]}>
       <AdventureArtwork id={item.id} size={width>=720?105:87}/>
       <Text numberOfLines={2} style={styles.title}>{t(item.labelKey)}</Text>
       <Text style={styles.count}>{adventureCount(item.id,packs,[])} {t(adventureCount(item.id,packs,[])===1?"native.browse.packOne":"native.browse.packsCount")}</Text>
     </KidsTap>)}
   </View>
   {loaded&&!loading&&available.length===0?<Text style={styles.muted}>{t("native.adventure.empty")}</Text>:null}
   <KidsTap accessibilityRole="button" onPress={()=>go({pathname:"/all-packs",params:{from:"worlds"}})} style={styles.allPacks}>
     <Text style={styles.allPacksTitle}>{t("native.browse.allPacks")}</Text>
     <Text style={styles.arrow}>→</Text>
   </KidsTap>
 </Screen>;
}
const styles=StyleSheet.create({
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:12},
 tile:{minHeight:160,borderRadius:23,alignItems:"center",justifyContent:"center",padding:12,gap:7},
 title:{fontSize:17,lineHeight:21,fontWeight:"900",textAlign:"center",color:theme.colors.ink},
 count:{fontSize:12,fontWeight:"800",color:theme.colors.accent},
 notice:{backgroundColor:"#FFF1DD",padding:16,borderRadius:14},
 link:{fontSize:14,fontWeight:"900",color:theme.colors.accent},
 muted:{fontSize:14,fontWeight:"700",color:theme.colors.muted},
 allPacks:{borderRadius:22,padding:20,backgroundColor:theme.colors.lilac,
  flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 allPacksTitle:{fontSize:20,fontWeight:"900",color:theme.colors.ink},
 arrow:{fontSize:25,fontWeight:"900",color:theme.colors.accent},
});
