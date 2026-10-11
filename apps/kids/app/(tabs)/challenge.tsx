import { Text, StyleSheet } from "react-native";
import { Screen, Banner } from "../../src/components/Screen";
import { useKidsLocale } from "../../src/state/locale";
import { theme } from "../../src/theme";
export default function ChallengeScreen(){
 const {t}=useKidsLocale();
 return <Screen title={t("kids.challenge.title")} subtitle={t("kids.challenge.lead")}>
   <Banner emoji="🧩" title={t("native.preview")} detail={t("native.challengeHint")} tint={theme.colors.sky}/>
   <Text style={styles.note}>{t("native.phaseThree")}</Text>
 </Screen>;
}
const styles=StyleSheet.create({note:{fontSize:15,lineHeight:22,color:theme.colors.muted}});
