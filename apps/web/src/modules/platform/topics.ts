import { db } from "./db";
import type { Prisma } from "../../generated/prisma/client";
import { normalizeTopicInputs, normalizeTopicKey, normalizeTopicName, type TopicInput, type QuizAnswer } from "./topic-normalization";
export { normalizeTopicKey } from "./topic-normalization";

export async function saveTopicLinks(tx: Prisma.TransactionClient, quizId: string, inputs: TopicInput[], answer: QuizAnswer) {
  const normalized=normalizeTopicInputs(inputs,answer);
  await tx.quizTopic.deleteMany({where:{quizId}});
  for(const [position,item] of normalized.entries()){
    const topic=await tx.topic.upsert({where:{key:item.key},update:{},create:{key:item.key,name:item.name}});
    await tx.quizTopic.create({data:{quizId,topicId:topic.id,position,isSpoiler:item.isSpoiler}});
  }
}
export function topicSummaries(links: Array<{isSpoiler:boolean;topic:{id:string;key:string;name:string}}>, includeSpoilers=false) {
  return links.filter(link=>includeSpoilers||!link.isSpoiler).map(link=>({
    id:link.topic.id,key:link.topic.key,name:link.topic.name,
    ...(includeSpoilers?{isSpoiler:link.isSpoiler}:{})
  }));
}
/** No answer-linked/spoiler topics in public discovery. */
export async function topicList(p: Record<string,any>) {
  const q=p.q?normalizeTopicName(p.q):undefined;
  const where:Prisma.TopicWhereInput={
    quizLinks:{some:{isSpoiler:false,quiz:p.kids ? {publication:"PUBLISHED",safetyStatus:"APPROVED",kidsEligible:true} : {publication:"PUBLISHED",safetyStatus:{not:"RESTRICTED"}}}},
    ...(q?{OR:[{key:{contains:normalizeTopicKey(q)}},{aliases:{has:q}}]}:{})
  };
  const topics=await db().topic.findMany({where,orderBy:{name:"asc"},skip:p.offset,take:p.limit});
  return {items:topics.map(topic=>({id:topic.id,key:topic.key,name:topic.name})),limit:p.limit,offset:p.offset};
}
