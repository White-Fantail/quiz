import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
export function AdventureTile({emoji,title,detail,tint,onPress}:{emoji:string;title:string;detail:string;tint:string;onPress:()=>void}) {
 return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title+". "+detail}
  style={({pressed})=>[styles.tile,{backgroundColor:tint,opacity:pressed?0.8:1}]}>
  <Text style={styles.emoji} accessibilityElementsHidden>{emoji}</Text>
  <View><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>
  <Text style={styles.arrow} accessibilityElementsHidden>↗</Text>
 </Pressable>;
}
const styles=StyleSheet.create({
 tile:{flexGrow:1,minWidth:220,borderRadius:theme.radius.card,padding:22,minHeight:180,justifyContent:"space-between"},
 emoji:{fontSize:40},title:{fontSize:21,fontWeight:"800",color:theme.colors.ink},
 detail:{fontSize:14,color:theme.colors.muted,marginTop:7,lineHeight:20},
 arrow:{fontSize:23,position:"absolute",right:19,top:18,color:theme.colors.ink},
});
