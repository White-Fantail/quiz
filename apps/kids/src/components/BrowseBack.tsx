import {StyleSheet,Text,View} from "react-native";
import {KidsTap} from "./KidsTap";
import {KidsEmojiIcon} from "./KidsIcon";
import {theme} from "../theme";
import {useKidsLocale} from "../state/locale";

export function BrowseBack({onPress}:{onPress:()=>void}){
 const {t}=useKidsLocale();
 return <KidsTap accessibilityRole="button" accessibilityLabel={t("native.browse.back")}
   onPress={onPress} style={styles.button}>
   <Text style={styles.arrow}>‹</Text>
   <Text style={styles.label}>{t("native.browse.back")}</Text>
 </KidsTap>;
}
const styles=StyleSheet.create({
 button:{flexDirection:"row",alignItems:"center",alignSelf:"flex-start",
   gap:7,paddingVertical:9,paddingHorizontal:12,backgroundColor:theme.colors.lilac,
   minHeight:44,borderRadius:16},
 arrow:{fontSize:28,lineHeight:29,fontWeight:"900",color:theme.colors.accent},
 label:{fontSize:15,fontWeight:"900",color:theme.colors.accent},
});
