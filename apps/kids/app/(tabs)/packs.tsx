import {useKidsNavigation} from "../../src/useKidsNavigation";
import { KidsTap } from "../../src/components/KidsTap";
import {useEffect,useState} from "react";
import {StyleSheet,Text,View} from "react-native";
import type {KidPackItem,KidsFeaturedItem} from "@quizdip/api-client";
import {Screen} from "../../src/components/Screen";
import {KidsEmojiIcon} from "../../src/components/KidsIcon";
import {kidsApi} from "../../src/services/api";
import {useKidsLocale} from "../../src/state/locale";
import {useKidsSession} from "../../src/state/session";
import {useKidsTime} from "../../src/state/time";
import {theme} from "../../src/theme";

const PAGE_SIZE=8;
export default function KidsPacks(){
  const go=useKidsNavigation(),{t}=useKidsLocale(),kid=useKidsSession(),time=useKidsTime();
  const token=kid.status==="active"?kid.token:null;
  const [page,setPage]=useState(0),[retry,setRetry]=useState(0);
  const [items,setItems]=useState<KidPackItem[]>([]);
  const [featured,setFeatured]=useState<KidsFeaturedItem[]>([]);
  const [more,setMore]=useState(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    if(!token||!kidsApi||time.status!=="allowed"){
      setItems([]);setFeatured([]);setLoading(false);return()=>{active=false};
    }
    setLoading(true);setError(false);
    void Promise.all([kidsApi.packs(token,page*PAGE_SIZE,PAGE_SIZE),
      kidsApi.features(token)]).then(([packs,picks])=>{
      if(!active)return;
      setItems(packs.items);setMore(packs.hasMore);setFeatured(picks.items);
    }).catch(()=>{if(active){setError(true);setItems([]);setFeatured([]);}})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[token,time.status,page,retry]);
  if(time.status!=="allowed")return <Screen title={t("native.packs.title")}>
    <Text style={styles.note}>{t("native.session.checking")}</Text>
  </Screen>;
  return <Screen title={t("native.packs.title")} subtitle={t("native.packs.lead")}>
    {!!featured.length&&<View style={styles.section}>
      <View style={styles.inline}><KidsEmojiIcon emoji="✨" size={23}/><Text style={styles.heading}>{t("native.packs.featured")}</Text></View>
      <Text style={styles.note}>{t("native.packs.curated")}</Text>
      {featured.map(item=><KidsTap accessibilityRole="button" key={item.id} style={styles.feature}
        onPress={()=>go(item.type==="PACK"?{pathname:"/game",params:{packId:item.id}}:
          {pathname:"/game",params:{quizId:item.id}})}>
        <View style={styles.inline}><KidsEmojiIcon emoji="⭐" size={20}/><Text style={[styles.title,{flex:1}]}>{item.headline||item.title}</Text></View>
        <Text style={styles.note}>{item.description}</Text>
        <Text style={styles.note}>{item.creator} · {item.questionCount} {t("native.packs.questions")}</Text>
      </KidsTap>)}
    </View>}
    {loading&&<Text style={styles.note}>{t("kids.explore.loading")}</Text>}
    {error&&<View style={styles.section}>
      <Text style={styles.note}>{t("kids.explore.error")}</Text>
      <KidsTap accessibilityRole="button" onPress={()=>setRetry(x=>x+1)}>
        <Text style={styles.link}>{t("native.retry")}</Text>
      </KidsTap>
    </View>}
    {!loading&&!error&&!items.length&&<Text style={styles.note}>{t("native.packs.empty")}</Text>}
    <View style={styles.section}>{items.map(pack=><KidsTap key={pack.id}
      accessibilityRole="button" accessibilityLabel={pack.title}
      style={styles.card} onPress={()=>go({pathname:"/game",params:{packId:pack.id}})}>
      <KidsEmojiIcon emoji="📚" size={34}/>
      <View style={{flex:1,gap:6}}>
       <Text style={styles.title}>{pack.title}</Text>
       <Text style={styles.note}>{pack.description}</Text>
       <Text style={styles.note}>{pack.questionCount} {t("native.packs.questions")} · {
         pack.orderMode==="RANDOM"?t("native.packs.random"):t("native.packs.ordered")}</Text>
       <Text style={styles.link}>▶ {t("native.packs.play")}</Text>
      </View>
    </KidsTap>)}</View>
    {!loading&&(page>0||more)&&<View style={styles.nav}>
      <KidsTap accessibilityRole="button" disabled={page===0} onPress={()=>setPage(p=>Math.max(0,p-1))}>
        <Text style={[styles.link,page===0&&styles.disabled]}>{t("kids.explore.previous")}</Text>
      </KidsTap>
      <Text style={styles.note}>{t("native.page")} {page+1}</Text>
      <KidsTap accessibilityRole="button" disabled={!more} onPress={()=>setPage(p=>p+1)}>
        <Text style={[styles.link,!more&&styles.disabled]}>{t("kids.explore.next")}</Text>
      </KidsTap>
    </View>}
    <Text style={styles.note}>{t("native.packs.noRatings")}</Text>
  </Screen>;
}
const styles=StyleSheet.create({
 section:{gap:12},inline:{flexDirection:"row",alignItems:"center",gap:8},heading:{fontSize:20,fontWeight:"900",color:theme.colors.ink},
 card:{flexDirection:"row",gap:14,backgroundColor:theme.colors.card,padding:18,
   borderRadius:20,borderWidth:1,borderColor:theme.colors.outline},
 feature:{backgroundColor:theme.colors.lilac,padding:18,borderRadius:20,gap:7},
 title:{fontSize:18,fontWeight:"800",color:theme.colors.ink},
 note:{fontSize:14,lineHeight:21,color:theme.colors.muted},link:{fontSize:15,
   fontWeight:"800",color:theme.colors.accent,marginTop:4},
 nav:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 disabled:{opacity:0.35}
});
