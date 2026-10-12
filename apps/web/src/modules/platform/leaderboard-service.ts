import { db } from "./db";
import { fail } from "./auth";
import {
  difficultQuizzes, periodBounds, personalSummary, rankCandidates,
  type RankingAttempt, type RankingCategory, type RankingPeriod
} from "./leaderboard-rules";

const PAGE_SIZE=1200;
const MAX_SESSIONS=24000;
const MAX_USERS=10000;

// All rankings use completed, authenticated GENERAL plays. Child-owned sessions
// are excluded even if a future import accidentally sets a userId.
async function qualifyingAttempts(options:{
  userIds?:string[];start?:Date|null;end?:Date;quizIds?:string[];quizId?:string;
}):Promise<RankingAttempt[]> {
  if(options.userIds?.length===0 || options.quizIds?.length===0)return [];
  const where:any={
    status:{in:["SOLVED","FAILED"]},userId:options.userIds?{in:options.userIds}:{not:null},
    finishedAt:{gte:options.start??new Date(0),lt:options.end??new Date()},
    kidSingle:{is:null},
    OR:[{runId:null},{run:{is:{lane:"GENERAL",kidOwnership:{is:null}}}}],
    quiz:{publication:"PUBLISHED",safetyStatus:{not:"RESTRICTED"}}
  };
  if(options.quizId)where.quizId=options.quizId;
  if(options.quizIds)where.quizId={in:options.quizIds};
  const attempts:RankingAttempt[]=[];
  let cursor:string|undefined,scanned=0;
  for(;;){
    const rows=await db().playSession.findMany({
      where,orderBy:[{finishedAt:"asc"},{id:"asc"}],
      take:PAGE_SIZE,cursor:cursor?{id:cursor}:undefined,skip:cursor?1:0,
      select:{
        id:true,userId:true,quizId:true,status:true,score:true,usedClues:true,finishedAt:true,
        revision:{select:{clues:true}},
        quiz:{select:{
          authorId:true,answerType:true,
          topicLinks:{where:{isSpoiler:false},orderBy:{position:"asc"},take:1,select:{topicId:true}}
        }}
      }
    });
    scanned+=rows.length;
    if(scanned>MAX_SESSIONS)
      fail(503,"ranking_over_capacity","Ranking data exceeds the live aggregation limit; try again later.");
    for(const row of rows){
      if(!row.userId||!row.finishedAt||row.quiz.authorId===row.userId)continue;
      attempts.push({
        userId:row.userId,quizId:row.quizId,status:row.status as "SOLVED"|"FAILED",
        score:row.score,usedClues:row.usedClues,
        clueCount:Array.isArray(row.revision.clues)?row.revision.clues.length:0,
        finishedAt:row.finishedAt,authorId:row.quiz.authorId,
        topicId:row.quiz.topicLinks[0]?.topicId??
          (row.quiz.answerType!=="other"?"type:"+row.quiz.answerType:null)
      });
    }
    if(rows.length<PAGE_SIZE)break;
    cursor=rows[rows.length-1].id;
  }
  return attempts;
}

/** Public rankings never retrieve or expose unverified or non-consenting identities. */
export async function publicLeaderboard(p:{
  period?:RankingPeriod;category?:RankingCategory;limit:number;offset:number;quizId?:string
}) {
  const period=p.period??"all",category=p.category??"solved";
  const now=new Date(),{start,end}=periodBounds(period,now);
  const users=await db().user.findMany({
    where:{leaderboardEligible:true,leaderboardOptIn:true},
    select:{id:true,displayName:true,createdAt:true},take:MAX_USERS+1
  });
  if(users.length>MAX_USERS)fail(503,"ranking_over_capacity","Too many eligible players for live rankings.");
  const attempts=await qualifyingAttempts({userIds:users.map(u=>u.id),start,end,quizId:p.quizId});
  let hard=new Map<string,number>();
  if(category==="challenge" && attempts.length){
    const ids=[...new Set(attempts.map(a=>a.quizId))];
    // Hardness uses distinct registered general players, not just users who
    // opted into public visibility. It reveals only aggregate difficulty.
    const historical=await qualifyingAttempts({quizIds:ids,end:now});
    hard=difficultQuizzes(historical);
  }
  const ranked=rankCandidates(
    users.map(u=>({userId:u.id,displayName:u.displayName,createdAt:u.createdAt})),
    attempts,category,hard,now
  );
  return {
    items:ranked.slice(p.offset,p.offset+p.limit).map(row=>({
      rank:row.rank,userId:row.userId,displayName:row.displayName,
      value:row.value,score:row.score,quizzesSolved:row.solved,finished:row.finished,
      detectiveScore:row.detectiveScore,topics:row.topics,challengeScore:row.challengeScore
    })),
    total:ranked.length,period,category,windowStart:start?.toISOString()??null,
    windowEnd:end.toISOString(),
    rankingBasis:"UTC windows; first completed attempt per quiz per user; GENERAL adult verified opt-in only",
    minimum:category==="detective"?5:category==="challenge"?10:category==="explorer"?2:0
  };
}

export async function personalRankingPeriods(userId:string) {
  const now=new Date();
  const attempts=await qualifyingAttempts({userIds:[userId],end:now});
  const periods={} as Record<RankingPeriod,ReturnType<typeof personalSummary>>;
  for(const period of ["day","week","month","all"] as const) {
    const {start}=periodBounds(period,now);
    periods[period]=personalSummary(start?attempts.filter(a=>a.finishedAt>=start):attempts);
  }
  return {periods,periodBasis:"UTC; first completed attempt per quiz; own authored questions and Kids excluded"};
}
