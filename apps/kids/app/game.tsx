import { useCallback,useEffect,useRef,useState } from "react";
import { ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View } from "react-native";
import { Redirect,useLocalSearchParams,useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { KidQuestion,KidRunResult,KidGuessResult } from "@quizdip/api-client";
import { ApiError } from "@quizdip/api-client";
import { activeImageStage } from "@quizdip/domain";
import { Screen } from "../src/components/Screen";
import { KidsEmojiIcon } from "../src/components/KidsIcon";
import { KidClueView,SafeKidMedia } from "../src/components/KidClueView";
import { useKidsLocale } from "../src/state/locale";
import { useKidsSession } from "../src/state/session";
import { useKidsTime } from "../src/state/time";
import { kidsApi } from "../src/services/api";
import { theme } from "../src/theme";

const SAVED="quizdip-kids-active-game-v1";
type Ref= {kind:"run";runId:string;runToken:string;mode:"RANDOM_FIVE"|"PACK"} |
          {kind:"single";sessionId:string;sessionToken:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function finished(v:KidQuestion|KidRunResult):v is KidRunResult {
 return "status" in v && v.status==="FINISHED" && !("sessionId" in v);
}
async function save(value:Ref|null) {
 if(value)await SecureStore.setItemAsync(SAVED,JSON.stringify(value),{
  keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
 });
 else await SecureStore.deleteItemAsync(SAVED);
}
async function read():Promise<Ref|null>{
 try {
  const raw=await SecureStore.getItemAsync(SAVED);
  if(!raw)return null;
  const v=JSON.parse(raw);
  if(v?.kind==="run" && uuid.test(v.runId) && /^[\w-]{32,200}$/.test(v.runToken) &&
   ["RANDOM_FIVE","PACK"].includes(v.mode))return v as Ref;
  if(v?.kind==="single" && uuid.test(v.sessionId) && /^[\w-]{32,200}$/.test(v.sessionToken))
   return v as Ref;
 }catch{/* Unknown state is not trusted. */}
 await save(null);
 return null;
}
export default function KidGameScreen(){
 const params=useLocalSearchParams<{quizId?:string;packId?:string;mode?:string}>();
 const kid=useKidsSession(),{t}=useKidsLocale(),router=useRouter();
 const time=useKidsTime();
 const [reference,setReference]=useState<Ref|null>(null);
 const [question,setQuestion]=useState<KidQuestion|null>(null);
 const [summary,setSummary]=useState<KidRunResult|null>(null);
 const [result,setResult]=useState<KidGuessResult|null>(null);
 const [guess,setGuess]=useState("");
 const [reportNotice,setReportNotice]=useState("");
 const [reportOpen,setReportOpen]=useState(false);
 const [dismissedBreak,setDismissedBreak]=useState(-1);
 const [pending,setPending]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const boot=useRef("");
 const token=kid.status==="active"?kid.token:null;
 const retrieve=useCallback(async(ref:Ref,deviceToken:string)=>{
  if(!kidsApi)throw new ApiError("missing_api_origin");
  const current=ref.kind==="run"
    ? await kidsApi.currentRun(deviceToken,ref.runId,ref.runToken)
    : await kidsApi.currentSingle(deviceToken,ref.sessionId,ref.sessionToken);
  if(finished(current)){setSummary(current);setQuestion(null);await save(null);}
  else {setSummary(null);setQuestion(current);}
 },[]);
 useEffect(()=>{
  if(!token || !kidsApi)return;
  const key=token+":"+(params.quizId??"")+":"+(params.packId??"")+":"+(params.mode??"");
  if(boot.current===key)return;
  boot.current=key;
  let active=true;
  setQuestion(null);setSummary(null);setResult(null);setError("");setLoading(true);
  void (async()=>{
   try{
    let ref:Ref|null=null;
    if(params.packId&&uuid.test(params.packId)){
      const started=await kidsApi!.startPack(token,params.packId);
      ref={kind:"run",runId:started.runId,runToken:started.runToken,mode:"PACK"};
      await save(ref);
    }else if(params.quizId && uuid.test(params.quizId)){
      const started=await kidsApi!.startSingle(token,params.quizId);
      ref={kind:"single",sessionId:started.sessionId,sessionToken:started.sessionToken};
      await save(ref);
    }else if(params.mode==="RANDOM_FIVE"){
      const started=await kidsApi!.startRun(token,params.mode);
      ref={kind:"run",runId:started.runId,runToken:started.runToken,mode:params.mode};
      await save(ref);
    }else ref=await read();
    if(!active)return;
    if(!ref){setError(t("native.play.noActive"));return;}
    setReference(ref);
    await retrieve(ref,token);
   }catch(e){
    if(!active)return;
    if(e instanceof ApiError && [401,403,404,409,410].includes(e.status??0))await save(null);
    setError(e instanceof ApiError && e.code==="not_enough_questions"
      ?t("native.play.notEnough"):t("native.play.error"));
   }finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[token,params.quizId,params.packId,params.mode,retrieve,t]);
 const guarded=async(task:()=>Promise<void>)=>{
  if(pending)return;
  setPending(true);setError("");
  try{await task();}
  catch(e){
    const withdrawn=e instanceof ApiError &&
      ["kid_content_withdrawn","kid_media_withdrawn","question_suspended","pack_unavailable","kid_pack_changed","kid_pack_locale"].includes(e.code);
    if(withdrawn){await save(null);setQuestion(null);setSummary(null);setReference(null);}
    if(e instanceof ApiError && [401,403].includes(e.status??0))void kid.reload();
    setError(withdrawn?t("native.play.withdrawn"):t("native.play.error"));
  }
  finally{setPending(false);}
 };
 const clue=()=>void guarded(async()=>{
   if(!token||!question||!kidsApi)return;
   const next=await kidsApi.nextClue(token,question.sessionId,question.sessionToken);
   setQuestion(prev=>prev&&prev.sessionId===question.sessionId?{
      ...prev,clues:[...prev.clues,next.clue],clueIndex:next.clueIndex,clueCount:next.clueCount,canGuess:true
   }:prev);
   setResult(null);
 });
 const submit=(answer:string)=>void guarded(async()=>{
   if(!token||!question||!kidsApi||!question.canGuess)return;
   const v=await kidsApi.guess(token,question.sessionId,question.sessionToken,answer);
   setResult(v);setGuess("");
   setQuestion(prev=>prev?{...prev,sessionStatus:v.status,canGuess:false}:prev);
 });
 const sendReport=(reason:"UNSAFE"|"INCORRECT"|"BROKEN_MEDIA")=>{
   if(!token||!question||!kidsApi)return;
   const id=question.quizId;
   setReportOpen(false);
   void kidsApi.report(token,id,reason).then(()=>setReportNotice(t("native.report.thanks")))
     .catch(()=>setReportNotice(t("native.report.failed")));
 };
 const next=()=>void guarded(async()=>{
   if(!token||!reference)return;
   if(reference.kind==="single"){
     await save(null);
     router.replace("/explore");
     return;
   }
   setResult(null);setGuess("");
   await retrieve(reference,token);
 });
 if(kid.status!=="active"){
   if(kid.status==="checking")return <Screen title="QuizDip Kids"><ActivityIndicator/></Screen>;
   return <Redirect href="/setup"/>;
 }
 if(time.status==="blocked")return <Redirect href="/time-up" />;
 if(time.status==="checking")return <Screen title={t("native.session.checking")}><ActivityIndicator/></Screen>;
 if(loading)return <Screen title={t("native.play.loading")}><ActivityIndicator color={theme.colors.accent}/></Screen>;
 if(error&&!question&&!summary)return <Screen title={t("native.play.error")}>
   <Text style={styles.note}>{error}</Text>
   <Pressable accessibilityRole="button" style={styles.button} onPress={()=>router.replace("/explore")}>
     <Text style={styles.buttonText}>{t("native.play.back")}</Text>
   </Pressable>
 </Screen>;
 if(summary)return <Screen title={t("native.play.complete")}>
   <View style={styles.results}>
     <KidsEmojiIcon emoji="🏆" size={65} color={theme.colors.accent}/>
     <Text style={styles.heading}>{t("native.play.wellDone")}</Text>
     <Text style={styles.score}>{summary.score} {t("native.play.points")}</Text>
     <Text style={styles.note}>{summary.solved} / {summary.completed} {t("native.play.correct")}</Text>
   </View>
   <Pressable accessibilityRole="button" onPress={()=>router.replace("/treasures")} style={styles.button}>
     <View style={styles.inline}><KidsEmojiIcon emoji="⭐" size={20} color="#FFFFFF"/><Text style={styles.buttonText}>{t("kids.nav.treasures")}</Text></View>
   </Pressable>
   <Pressable accessibilityRole="button" onPress={()=>router.replace(reference?.kind==="run"&&reference.mode==="PACK"?"/packs":"/challenge")} style={styles.secondary}>
     <Text style={styles.secondaryText}>{t("native.play.back")}</Text>
   </Pressable>
 </Screen>;
 if(!question)return <Screen title={t("native.play.noActive")}>
   <Pressable accessibilityRole="button" onPress={()=>router.replace(reference?.kind==="run"&&reference.mode==="PACK"?"/packs":"/challenge")} style={styles.button}>
     <Text style={styles.buttonText}>{t("native.play.back")}</Text>
   </Pressable>
 </Screen>;
 const ended=result?.status==="SOLVED"||result?.status==="FAILED"||
   question.sessionStatus==="SOLVED"||question.sessionStatus==="FAILED";
 const age=kid.session.profile.ageBand;
 const reminderEvery=time.time?.limits.breakEveryMinutes??0;
 const reminderNumber=reminderEvery>0?Math.floor((time.time?.sessionMinutesUsed??0)/reminderEvery):0;
 return <Screen title={question.title} subtitle={question.prompt}>
   {reminderNumber>0 && reminderNumber!==dismissedBreak?<Pressable accessibilityRole="button"
     style={styles.restNotice} onPress={()=>setDismissedBreak(reminderNumber)}>
     <View style={styles.inline}><KidsEmojiIcon emoji="🍎" size={22}/><Text style={styles.restText}>{t("native.time.reminder")}</Text></View>
     <Text style={styles.note}>{t("native.time.dismiss")}</Text>
   </Pressable>:null}
   <View style={styles.progress}>
     <Text style={styles.progressText}>{question.round?
       t("native.play.question")+" "+question.round+" / "+(question.total??5):t("native.play.single")}</Text>
     <Text style={styles.progressText}>{t("native.play.hint")} {question.clueIndex} / {question.clueCount}</Text>
   </View>
   {(Array.isArray(question.promptMediaIds)?question.promptMediaIds:[]).map(id=>
      <SafeKidMedia key={"prompt:"+id} token={token!} mediaId={id}
        sessionId={question.sessionId} sessionToken={question.sessionToken}/>)}
   {(question.clues??[]).map((clue,i)=>{
     const stage=activeImageStage(question.clues,i);
     if(!stage&&!clue.text&&!clue.map)return null;
     return <View key={clue.id??String(i)} style={{gap:8}}>
     <View style={styles.inline}><KidsEmojiIcon emoji="✨" size={18} color={theme.colors.accent}/><Text style={styles.hintLabel}>{t("native.play.hint")} {i+1}</Text></View>
     <KidClueView clue={clue} mediaStage={stage} token={token!} sessionId={question.sessionId}
       sessionToken={question.sessionToken}/>
   </View>})}
   {result?<View style={[styles.feedback,result.correct?styles.success:styles.tryAgain]}>
     <Text style={styles.feedbackText}>{result.correct?t("native.play.correctMessage"):
       ended?t("native.play.tryNextTime"):t("native.play.nextHint")}</Text>
     {result.answer?<Text style={styles.note}>{t("native.play.answer")} {result.answer}</Text>:null}
     {ended?<Text style={styles.note}>+{result.score} {t("native.play.points")}</Text>:null}
   </View>:null}
   {error?<Text accessibilityRole="alert" style={styles.warning}>{error}</Text>:null}
   {!ended?<>
     {question.canGuess?<>
       {(question.responseMode==="multiple-choice" || age!=="OLDER") && (question.options?.length??0)>=2?
         <View style={styles.options}>
           {(question.options??[]).map(option=>
             <Pressable key={option} disabled={pending} accessibilityRole="button"
               style={styles.option} onPress={()=>submit(option)}>
               <Text style={styles.optionText}>{option}</Text>
             </Pressable>)}
         </View>:
         <View style={styles.answer}>
           <TextInput value={guess} onChangeText={setGuess} maxLength={200}
             autoCorrect={false} placeholder={t("native.play.placeholder")}
             accessibilityLabel={t("native.play.placeholder")} style={styles.field}/>
           <Pressable accessibilityRole="button" disabled={pending||!guess.trim()} style={styles.button}
             onPress={()=>submit(guess.trim())}><Text style={styles.buttonText}>{t("native.play.guess")}</Text></Pressable>
         </View>}
     </>:null}
     {question.clueIndex<question.clueCount?
       <Pressable accessibilityRole="button" disabled={pending} style={styles.secondary} onPress={clue}>
         <View style={styles.inline}><KidsEmojiIcon emoji="✨" size={19}/><Text style={styles.secondaryText}>{t("native.play.reveal")}</Text></View>
       </Pressable>:null}
   </>:null}
   {reportNotice?<Text accessibilityRole="alert" style={styles.note}>{reportNotice}</Text>:null}
   <Pressable accessibilityRole="button" onPress={()=>setReportOpen(v=>!v)} style={styles.reportButton}>
     <View style={styles.inline}><KidsEmojiIcon emoji="🛡️" size={18} color={theme.colors.muted}/><Text style={styles.reportText}>{t("native.report.title")}</Text></View>
   </Pressable>
   {reportOpen?<View style={styles.reportChoices}>
     <Text style={styles.note}>{t("native.report.help")}</Text>
     {([["UNSAFE","native.report.unsafe"],["INCORRECT","native.report.incorrect"],
       ["BROKEN_MEDIA","native.report.broken"]] as const).map(([reason,label])=>
       <Pressable key={reason} accessibilityRole="button" style={styles.secondary}
         onPress={()=>sendReport(reason)}>
         <Text style={styles.secondaryText}>{t(label)}</Text>
       </Pressable>)}
     <Pressable accessibilityRole="button" onPress={()=>setReportOpen(false)}>
       <Text style={styles.note}>{t("kids.guardian.cancel")}</Text>
     </Pressable>
   </View>:null}
   {ended?<Pressable accessibilityRole="button" disabled={pending} style={styles.button} onPress={next}>
     <Text style={styles.buttonText}>{reference?.kind==="single"?t("native.play.back"):t("native.play.continue")}</Text>
   </Pressable>:null}
 </Screen>;
}
const styles=StyleSheet.create({
 inline:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},
 reportButton:{alignItems:"center",padding:14,borderRadius:14,backgroundColor:theme.colors.card},
 reportChoices:{backgroundColor:theme.colors.card,padding:16,borderRadius:18,gap:12},
 reportText:{fontSize:14,fontWeight:"700",color:theme.colors.muted},
 restNotice:{backgroundColor:theme.colors.peach,borderRadius:17,padding:17,gap:6},
 restText:{color:theme.colors.ink,fontSize:17,fontWeight:"800"},
 progress:{flexDirection:"row",justifyContent:"space-between",backgroundColor:theme.colors.lilac,padding:16,borderRadius:16,gap:10},
 progressText:{fontSize:15,fontWeight:"800",color:theme.colors.ink},
 hintLabel:{color:theme.colors.accent,fontWeight:"800",fontSize:15,paddingStart:5},
 note:{color:theme.colors.muted,fontSize:16,lineHeight:23},
 results:{backgroundColor:theme.colors.lilac,padding:30,borderRadius:24,alignItems:"center",gap:14},
 heading:{fontSize:26,fontWeight:"900",color:theme.colors.ink},
 score:{fontSize:34,color:theme.colors.accent,fontWeight:"900"},
 button:{padding:17,borderRadius:18,backgroundColor:theme.colors.accent,alignItems:"center"},
 buttonText:{fontSize:18,fontWeight:"900",color:"#FFFFFF"},
 secondary:{padding:17,borderRadius:18,backgroundColor:theme.colors.mint,alignItems:"center"},
 secondaryText:{fontSize:17,fontWeight:"800",color:theme.colors.ink},
 options:{gap:12},
 option:{backgroundColor:theme.colors.peach,minHeight:60,padding:16,borderRadius:17,justifyContent:"center"},
 optionText:{color:theme.colors.ink,fontSize:19,fontWeight:"800",textAlign:"center"},
 answer:{gap:12},field:{borderWidth:1,borderColor:theme.colors.outline,borderRadius:14,
   backgroundColor:theme.colors.card,padding:16,fontSize:19,color:theme.colors.ink},
 feedback:{padding:20,borderRadius:18,gap:10},feedbackText:{fontWeight:"900",fontSize:19,color:theme.colors.ink},
 success:{backgroundColor:theme.colors.mint},tryAgain:{backgroundColor:theme.colors.peach},
 warning:{color:theme.colors.error,fontWeight:"700"}
});
