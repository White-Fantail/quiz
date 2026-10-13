import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { KidsEmojiIcon } from "./KidsIcon";

export function Screen({title,subtitle,headerAction,children}:PropsWithChildren<{title:string;subtitle?:string;headerAction?:ReactNode}>) {
  const {width}=useWindowDimensions();
  return <SafeAreaView style={styles.safe} edges={["top","left","right"]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:width>=700?32:18,paddingBottom:34,flexGrow:1}}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" numberOfLines={2}
            style={[styles.title,{fontSize:width>=700?36:29},headerAction?styles.titleWithAction:undefined]}>{title}</Text>
          {headerAction?<View style={styles.headerAction}>{headerAction}</View>:null}
        </View>
        {subtitle?<Text style={styles.subtitle}>{subtitle}</Text>:null}
        <View style={styles.content}>{children}</View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
export function Banner({emoji,title,detail,tint=theme.colors.lilac}:{emoji:string;title:string;detail:string;tint?:string}){
 return <View style={[styles.banner,{backgroundColor:tint}]} accessible accessibilityLabel={title+". "+detail}>
   <KidsEmojiIcon emoji={emoji} size={52}/>
   <View style={{flex:1}}><Text style={styles.bannerTitle}>{title}</Text><Text style={styles.bannerText}>{detail}</Text></View>
 </View>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.colors.background},
 body:{width:"100%",maxWidth:980,alignSelf:"center",paddingTop:22},
 title:{fontWeight:"900",color:theme.colors.ink,letterSpacing:-0.5},
 headerRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:14},
 titleWithAction:{flexShrink:1},
 headerAction:{flexShrink:0},
 subtitle:{fontSize:16,color:theme.colors.muted,lineHeight:23,marginTop:8},
 content:{marginTop:22,gap:18},
 banner:{flexDirection:"row",alignItems:"center",gap:16,borderRadius:theme.radius.card,padding:22},
 bannerTitle:{color:theme.colors.ink,fontSize:22,fontWeight:"800"},
 bannerText:{color:theme.colors.muted,fontSize:15,lineHeight:22,marginTop:7},
});
