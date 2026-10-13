import { useEffect, useState } from "react";
import { useLocalSearchParams,useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AnswerType } from "@quizdip/domain";
import type { KidsCatalogItem } from "@quizdip/api-client";
import { Screen } from "../../src/components/Screen";
import { KidsEmojiIcon } from "../../src/components/KidsIcon";
import { kidsApi } from "../../src/services/api";
import { useKidsSession } from "../../src/state/session";
import { useKidsLocale } from "../../src/state/locale";
import { theme } from "../../src/theme";

const SIZE=8;
const categories=[
 {type:"",key:"kids.explore.all",emoji:"✨"},
 {type:"animal",key:"kids.explore.animal",emoji:"🦁"},
 {type:"place",key:"kids.explore.place",emoji:"🌍"},
 {type:"thing",key:"kids.explore.thing",emoji:"🔎"},
 {type:"concept",key:"kids.explore.concept",emoji:"🚀"},
] as const;
type Category = typeof categories[number]["type"];
function category(value: unknown): Category {
 return typeof value==="string" && categories.some(c=>c.type===value) ? value as Category : "";
}

export default function ExploreScreen(){
 const router=useRouter();
 const {answerType:routeType,topic:routeTopic}=useLocalSearchParams<{answerType?:string;topic?:string}>();
 const {locale,t}=useKidsLocale();
 const kid=useKidsSession();
 const token=kid.status==="active"?kid.token:null;
 const [answerType,setAnswerType]=useState<Category>(()=>category(routeType));
 const [topic,setTopic]=useState(routeTopic==="dinosaur"?"dinosaur":"");
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0);
 const [state,setState]=useState<"loading"|"ready"|"error"|"missing">("loading");
 const [items,setItems]=useState<KidsCatalogItem[]>([]);
 const [hasMore,setHasMore]=useState(false);
 useEffect(()=>{
  setAnswerType(category(routeType));setTopic(routeTopic==="dinosaur"?"dinosaur":"");setPage(0);
 },[routeType,routeTopic]);
 useEffect(()=>{
  const controller=new AbortController();
  if(!kidsApi||!token){setState("missing");setItems([]);setHasMore(false);return ()=>controller.abort();}
  const api=kidsApi;
  setState("loading");setItems([]);setHasMore(false);
  void api.catalog(token,{
   ...(answerType?{answerType:answerType as AnswerType}:{}),
   ...(topic?{topic}:{}),offset:page*SIZE,limit:SIZE
  },locale).then(result=>{
   if(controller.signal.aborted)return;
   setItems(result.items);setHasMore(result.hasMore);setState("ready");
  }).catch(()=>{
   if(controller.signal.aborted)return;
   setState("error");setItems([]);setHasMore(false);
  });
  return ()=>controller.abort();
 },[token,locale,answerType,topic,page,retry]);
 return <Screen title={t("kids.explore.title")} subtitle={t("kids.explore.lead")}>
  {topic?<Pressable accessibilityRole="button" onPress={()=>{setTopic("");setPage(0);}}>
   <View style={styles.filterLabel}><KidsEmojiIcon emoji="🦕" size={18} color={theme.colors.accent}/>
     <Text style={styles.clear}>{t("kids.explore.dinosaur")} × {t("kids.explore.clearTopic")}</Text></View>
  </Pressable>:null}
  <View style={styles.filters} accessibilityLabel={t("kids.explore.filters")}>
   {categories.map(item=><Pressable key={item.type} accessibilityRole="button"
     accessibilityState={{selected:answerType===item.type}}
     onPress={()=>{setAnswerType(item.type);setTopic("");setPage(0);}}
     style={[styles.filter,answerType===item.type&&styles.active]}>
    <View style={styles.filterLabel}><KidsEmojiIcon emoji={item.emoji} size={20}/><Text style={styles.filterText}>{t(item.key)}</Text></View>
   </Pressable>)}
  </View>
  {state==="loading"?<Text style={styles.message}>{t("kids.explore.loading")}</Text>:null}
  {state==="missing"?<Text style={styles.message}>{t("native.notConfigured")}</Text>:null}
  {state==="error"?<View style={styles.box}><Text style={styles.message}>{t("kids.explore.error")}</Text>
    <Pressable accessibilityRole="button" onPress={()=>setRetry(x=>x+1)}><Text style={styles.action}>{t("native.retry")}</Text></Pressable>
   </View>:null}
  {state==="ready" && items.length===0?<Text style={styles.message}>{t("native.noQuizzes")}</Text>:null}
  <View style={styles.list}>
   {items.map(quiz=><Pressable key={quiz.id} accessibilityRole="button" onPress={()=>router.push({pathname:"/game",params:{quizId:quiz.id}})}
      style={styles.card} accessibilityLabel={quiz.title}>
     <KidsEmojiIcon emoji={quiz.answerType==="animal"?"🐾":quiz.answerType==="place"?"🌏":"🌟"} size={34}/>
     <View style={{flex:1}}>
       <Text style={styles.cardTitle}>{quiz.title}</Text>
       <Text numberOfLines={3} style={styles.cardText}>{quiz.prompt}</Text>
       <Text style={styles.approved}>✓ {t("kids.explore.approved")} · {t("native.play.open")}</Text>
     </View>
    </Pressable>)}
  </View>
  {state==="ready" && (page>0||hasMore)?<View style={styles.pagination}>
    <Pressable accessibilityRole="button" disabled={page===0} onPress={()=>setPage(p=>Math.max(0,p-1))}>
      <Text style={[styles.action,page===0&&styles.disabled]}>{t("kids.explore.previous")}</Text>
    </Pressable>
    <Text style={styles.message}>{t("native.page")} {page+1}</Text>
    <Pressable accessibilityRole="button" disabled={!hasMore} onPress={()=>setPage(p=>p+1)}>
      <Text style={[styles.action,!hasMore&&styles.disabled]}>{t("kids.explore.next")}</Text>
    </Pressable>
   </View>:null}
  <Text style={styles.note}>{t("native.play.discoverHelp")}</Text>
 </Screen>;
}
const styles=StyleSheet.create({
 filters:{flexDirection:"row",flexWrap:"wrap",gap:8},
 filterLabel:{flexDirection:"row",alignItems:"center",gap:8},
 filter:{backgroundColor:theme.colors.card,borderRadius:14,paddingHorizontal:14,paddingVertical:12},
 active:{backgroundColor:theme.colors.lilac},
 filterText:{fontSize:15,color:theme.colors.ink,fontWeight:"700"},
 clear:{color:theme.colors.accent,fontWeight:"700",fontSize:14,padding:8},
 list:{gap:12},box:{gap:12},message:{fontSize:15,color:theme.colors.muted,lineHeight:23},
 card:{flexDirection:"row",gap:14,backgroundColor:theme.colors.card,borderRadius:20,padding:17,borderColor:theme.colors.outline,borderWidth:1},
 cardTitle:{fontSize:19,fontWeight:"800",color:theme.colors.ink},
 cardText:{fontSize:14,color:theme.colors.muted,lineHeight:21,marginTop:6},
 approved:{fontSize:12,color:"#267C60",fontWeight:"700",marginTop:9},
 pagination:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 action:{padding:10,fontWeight:"800",color:theme.colors.accent},
 disabled:{opacity:0.35},note:{fontSize:14,color:theme.colors.muted,lineHeight:21}
});
