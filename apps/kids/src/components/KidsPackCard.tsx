import {StyleSheet,Text,View,useWindowDimensions} from "react-native";
import type {KidPackItem} from "@quizdip/api-client";
import {KidsTap} from "./KidsTap";
import {AdventureArtwork} from "./AdventureArtwork";
import {adventureById,adventureForPack} from "../adventures";
import {useKidsLocale} from "../state/locale";
import {theme} from "../theme";
import {useKidsNavigation} from "../useKidsNavigation";

export function KidsPackCard({pack}:{pack:KidPackItem}){
 const {width}=useWindowDimensions(),{t}=useKidsLocale(),go=useKidsNavigation();
 const world=adventureForPack(pack);
 return <KidsTap accessibilityRole="button" accessibilityLabel={pack.title}
   onPress={()=>go({pathname:"/game",params:{packId:pack.id}})}
   style={[styles.card,{width:width>=720?"48.7%":"100%"}]}>
   <View style={[styles.art,{backgroundColor:adventureById(world)?.tint||theme.colors.lilac}]}>
     <AdventureArtwork id={world} size={width>=720?105:91}/>
   </View>
   <View style={styles.copy}>
     <Text numberOfLines={2} style={styles.title}>{pack.title}</Text>
     <Text style={styles.meta}>{pack.questionCount} {t("native.adventure.questions")}</Text>
     <Text style={styles.link}>{t("native.adventure.open")} ▶</Text>
   </View>
 </KidsTap>;
}
export const packGrid={flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:12} as const;
const styles=StyleSheet.create({
 card:{minHeight:148,borderRadius:23,backgroundColor:"#FFFFFF",borderWidth:1,
   borderColor:theme.colors.outline,flexDirection:"row",overflow:"hidden"},
 art:{width:"37%",justifyContent:"center",alignItems:"center"},
 copy:{flex:1,padding:13,justifyContent:"space-around",gap:7},
 title:{fontSize:18,lineHeight:22,fontWeight:"900",color:theme.colors.ink},
 meta:{fontSize:13,fontWeight:"700",color:theme.colors.muted},
 link:{fontSize:14,fontWeight:"900",color:theme.colors.accent},
});
