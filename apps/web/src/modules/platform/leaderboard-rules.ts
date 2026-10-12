/** UTC windows avoid timezone-based advantages or ambiguous boundary shifts. */
export type RankingPeriod = "day"|"week"|"month"|"all";
export type RankingCategory = "solved"|"detective"|"challenge"|"explorer"|"rising";
export const RANKING_CATEGORIES:RankingCategory[]=["solved","detective","challenge","explorer","rising"];

export function periodBounds(period:RankingPeriod,now=new Date()):{start:Date|null;end:Date} {
  const end=new Date(now);
  if(period==="all")return {start:null,end};
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  if(period==="week")start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  if(period==="month")start.setUTCDate(1);
  return {start,end};
}

export type RankingAttempt={
  userId:string;quizId:string;status:"SOLVED"|"FAILED";score:number;
  usedClues:number;clueCount:number;finishedAt:Date;
  authorId:string;topicId:string|null;
};
export type PlayerSummary={
  solved:number;finished:number;failed:number;score:number;
  detectiveScore:number|null;topics:number;challengeScore:number;
};
export type RankingCandidate={userId:string;displayName:string;createdAt:Date};
export type RankingRow=RankingCandidate & PlayerSummary & {rank:number;value:number};

function firstCompletions(attempts:RankingAttempt[]):RankingAttempt[] {
  const first=new Map<string,RankingAttempt>();
  for(const item of [...attempts].sort((a,b)=>
    a.finishedAt.getTime()-b.finishedAt.getTime()||
    a.userId.localeCompare(b.userId)||a.quizId.localeCompare(b.quizId))) {
    // Replays cannot inflate rankings; first finished attempt wins even if it was wrong.
    const key=item.userId+"\u0000"+item.quizId;
    if(!first.has(key) && item.userId!==item.authorId)first.set(key,item);
  }
  return [...first.values()];
}

/** Difficulty is based on distinct first completions, never raw replay volume.
 * It is intentionally withheld until at least ten independent completions.
 */
export function difficultQuizzes(attempts:RankingAttempt[]):Map<string,number> {
  const grouped=new Map<string,{total:number;failed:number}>();
  for(const a of firstCompletions(attempts)) {
    const current=grouped.get(a.quizId)??{total:0,failed:0};
    current.total++;
    if(a.status==="FAILED")current.failed++;
    grouped.set(a.quizId,current);
  }
  const result=new Map<string,number>();
  for(const [id,s] of grouped) {
    if(s.total>=10 && s.failed/s.total>=0.4)
      result.set(id,Math.round(s.failed/s.total*100));
  }
  return result;
}

export function rankCandidates(
  candidates:RankingCandidate[],attempts:RankingAttempt[],category:RankingCategory,
  hard=new Map<string,number>(),now=new Date()
):RankingRow[] {
  const first=firstCompletions(attempts);
  const byUser=new Map<string,RankingAttempt[]>();
  for(const item of first){
    const bucket=byUser.get(item.userId)??[];
    bucket.push(item);byUser.set(item.userId,bucket);
  }
  const recent=new Date(now.getTime()-30*86400000);
  const rows:RankingRow[]=[];
  for(const user of candidates){
    const player=byUser.get(user.userId)??[];
    const solved=player.filter(a=>a.status==="SOLVED");
    const detective=solved.filter(a=>a.clueCount>=2);
    const categoryCounts=new Map<string,number>();
    for(const item of solved) {
      if(item.topicId)categoryCounts.set(item.topicId,(categoryCounts.get(item.topicId)??0)+1);
    }
    const topics=[...categoryCounts.values()].filter(n=>n>=2).length;
    const detectiveScore=detective.length>=5
      ? Math.round(detective.reduce((sum,a)=>sum+a.score,0)/detective.length):null;
    const challengeScore=solved.reduce((sum,a)=>
      sum+Math.round((hard.get(a.quizId)??0)*a.score/100),0);
    const summary:PlayerSummary={
      solved:solved.length,finished:player.length,failed:player.length-solved.length,
      score:solved.reduce((sum,a)=>sum+a.score,0),
      detectiveScore,topics,challengeScore
    };
    const value=category==="solved"?summary.solved:
      category==="detective"?(detectiveScore??0):
      category==="challenge"?challengeScore:
      category==="explorer"?topics:summary.solved;
    if(value<=0)continue;
    if(category==="rising" && user.createdAt<recent)continue;
    rows.push({...user,...summary,value,rank:0});
  }
  rows.sort((a,b)=>b.value-a.value||b.solved-a.solved||
    b.score-a.score||a.userId.localeCompare(b.userId));
  return rows.map((r,i)=>({...r,rank:i+1}));
}

export function personalSummary(attempts:RankingAttempt[]):PlayerSummary {
  const me={userId:"personal",displayName:"",createdAt:new Date(0)};
  const normalized=attempts.map(a=>({...a,userId:"personal"}));
  const solved=rankCandidates([me],normalized,"solved")[0];
  return solved?{
    solved:solved.solved,finished:solved.finished,failed:solved.failed,
    score:solved.score,detectiveScore:solved.detectiveScore,
    topics:solved.topics,challengeScore:solved.challengeScore
  }:{solved:0,finished:firstCompletions(normalized).length,
    failed:firstCompletions(normalized).length,score:0,detectiveScore:null,topics:0,challengeScore:0};
}
