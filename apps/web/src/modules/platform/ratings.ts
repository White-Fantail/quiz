import { db } from "./db";
import type { Actor } from "./auth";
import { ratingSummary, type RatingSummary } from "../quiz/rating-metadata";
/** Grouped lookup avoids an individual count request per Discover card. */
export async function ratingsForQuizzes(ids:string[]):Promise<Map<string,RatingSummary>> {
  const unique=[...new Set(ids)], map=new Map<string,RatingSummary>();
  if(!unique.length)return map;
  const rows=await db().review.groupBy({by:["quizId","rating"],
    where:{quizId:{in:unique}},_count:{_all:true}});
  for(const id of unique) {
    const item=rows.filter(r=>r.quizId===id);
    map.set(id,ratingSummary(item.find(r=>r.rating===1)?._count._all??0,
      item.find(r=>r.rating===-1)?._count._all??0));
  }
  return map;
}
export async function ratingsForQuiz(id:string):Promise<RatingSummary> {
  return (await ratingsForQuizzes([id])).get(id)??ratingSummary(0,0);
}
export async function myRatingForQuiz(quizId:string,actor:Actor|null):Promise<number|null> {
  if(!actor)return null;
  const row=await db().review.findUnique({where:{quizId_authorId:{quizId,authorId:actor.id}},select:{rating:true}});
  return row?.rating??null;
}
export function ratingAccess(actor:Actor|null,authorId:string,sessionUserId:string|null):
  "SIGN_IN"|"OWN_QUIZ"|"GUEST_SESSION"|"READY" {
  if(!actor)return "SIGN_IN";
  if(actor.id===authorId)return "OWN_QUIZ";
  if(actor.id!==sessionUserId)return "GUEST_SESSION";
  return "READY";
}
