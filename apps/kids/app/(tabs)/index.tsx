import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Banner } from "../../src/components/Screen";
import { AdventureTile } from "../../src/components/AdventureTile";
import { useKidsLocale } from "../../src/state/locale";
import { useKidsSession } from "../../src/state/session";
import { theme } from "../../src/theme";

const journeys=[
 {emoji:"🦕",title:"kids.topic.dinosaurs",desc:"kids.topic.dinosaursDesc",type:"animal",topic:"dinosaur",tint:theme.colors.lilac},
 {emoji:"🦁",title:"kids.topic.animals",desc:"kids.topic.animalsDesc",type:"animal",topic:"",tint:theme.colors.peach},
 {emoji:"🌍",title:"kids.topic.world",desc:"kids.topic.worldDesc",type:"place",topic:"",tint:theme.colors.mint},
 {emoji:"🚀",title:"kids.topic.science",desc:"kids.topic.scienceDesc",type:"concept",topic:"",tint:theme.colors.sky},
] as const;

export default function KidsHome(){
 const router=useRouter(),{width}=useWindowDimensions();
 const {t}=useKidsLocale();
 const kid=useKidsSession();
 const nickname=kid.status==="active"?kid.session.profile.nickname.trim():"";
 return <Screen title={nickname?`${t("native.home.hello")}, ${nickname}!`:t("kids.welcome")}
  subtitle={t("kids.subtitle")}
  headerAction={<Pressable accessibilityRole="button"
    accessibilityLabel={t("native.guardian.open")}
    accessibilityHint={t("native.guardian.detail")}
    onPress={()=>router.push("/parent")} style={styles.parentsButton}>
    <Text style={styles.parentsText}>{t("native.guardian.open")}</Text>
  </Pressable>}>
  <Banner emoji="✨" title="QuizDip Kids" detail={t("native.choose")}/>
  <Text style={styles.heading}>{t("kids.chooseTopic")}</Text>
  <View style={[styles.grid,{gap:width>=720?16:12}]}>
   {journeys.map(item=><View key={item.title} style={{width:width>=720?"48%":"100%"}}>
     <AdventureTile emoji={item.emoji} title={t(item.title)} detail={t(item.desc)}
      tint={item.tint} onPress={()=>router.push({pathname:"/explore",params:{answerType:item.type,topic:item.topic}})}/>
    </View>)}
  </View>
 </Screen>;
}
const styles=StyleSheet.create({
 parentsButton:{minHeight:44,borderRadius:14,borderWidth:1,borderColor:theme.colors.outline,
   backgroundColor:theme.colors.card,paddingHorizontal:14,justifyContent:"center",alignItems:"center"},
 parentsText:{color:theme.colors.accent,fontWeight:"800",fontSize:14},
 heading:{fontSize:23,fontWeight:"900",color:theme.colors.ink},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"}
});
