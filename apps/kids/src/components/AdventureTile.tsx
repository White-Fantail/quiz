import { Pressable, StyleSheet, Text, View } from "react-native";
import type {AdventureId} from "../adventures";
import { theme } from "../theme";
import { KidsEmojiIcon } from "./KidsIcon";
import { AdventureArtwork } from "./AdventureArtwork";

export function AdventureTile({id,emoji,title,detail,tint,count,playLabel,onPress}:{
 id:AdventureId;emoji:string;title:string;detail:string;tint:string;
 count:number;playLabel:string;onPress:()=>void;
}) {
 return <Pressable onPress={onPress} accessibilityRole="button"
   accessibilityLabel={title+". "+count+" "+playLabel}
   style={({pressed})=>[styles.tile,{backgroundColor:tint,opacity:pressed?0.85:1}]}>
  <View style={styles.top}>
   <View style={styles.iconCircle}><KidsEmojiIcon emoji={emoji} size={24}/></View>
   <View style={styles.arrow}><Text style={styles.arrowText}>↗</Text></View>
  </View>
  <View pointerEvents="none" style={styles.art}><AdventureArtwork id={id} size={148}/></View>
  <View style={styles.copy}>
   <Text numberOfLines={1} style={styles.title}>{title}</Text>
   <Text numberOfLines={2} style={styles.detail}>{detail}</Text>
   <Text style={styles.count}>{count} {playLabel} ›</Text>
  </View>
 </Pressable>;
}
const styles=StyleSheet.create({
 tile:{minHeight:248,borderRadius:28,padding:19,overflow:"hidden",justifyContent:"space-between"},
 top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",zIndex:2},
 iconCircle:{height:41,width:41,borderRadius:21,backgroundColor:"#FFFFFF99",alignItems:"center",justifyContent:"center"},
 arrow:{width:34,height:34,backgroundColor:"#FFFFFFAA",borderRadius:17,alignItems:"center",justifyContent:"center"},
 arrowText:{fontSize:21,fontWeight:"900",color:theme.colors.ink},
 art:{position:"absolute",right:-1,top:25},
 copy:{zIndex:1,paddingTop:97,maxWidth:"84%"},
 title:{fontSize:22,fontWeight:"900",color:theme.colors.ink,letterSpacing:-0.4},
 detail:{fontSize:14,fontWeight:"600",color:theme.colors.muted,marginTop:5,lineHeight:19},
 count:{fontSize:13,color:theme.colors.accent,fontWeight:"900",marginTop:12},
});
