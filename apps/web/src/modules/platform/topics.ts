import { db } from "./db";
import { publishedLocalization } from "./content-locale";
import type { Locale } from "../../i18n/core";
import type { Prisma } from "../../generated/prisma/client";
import { normalizeTopicInputs, normalizeTopicKey, normalizeTopicName, type TopicInput, type QuizAnswer } from "./topic-normalization";
export { normalizeTopicKey } from "./topic-normalization";

export async function saveTopicLinks(tx: Prisma.TransactionClient, quizId: string, inputs: TopicInput[], answer: QuizAnswer, locale = "und") {
  const normalized=normalizeTopicInputs(inputs,answer);
  await tx.quizTopic.deleteMany({where:{quizId}});
  for(const [position,item] of normalized.entries()){
    const topic=await tx.topic.upsert({where:{key:item.key},update:{},create:{key:item.key,name:item.name}});
    await tx.quizTopic.create({data:{quizId,topicId:topic.id,position,isSpoiler:item.isSpoiler}});
    if (locale !== "und") await tx.topicLocalization.upsert({
      where: { topicId_locale: { topicId: topic.id, locale } },
      create: { topicId: topic.id, locale, name: item.name }, update: {}
    });
  }
}
export function topicSummaries(links: Array<{isSpoiler:boolean;topic:{id:string;key:string;name:string}}>, includeSpoilers=false) {
  return links.filter(link=>includeSpoilers||!link.isSpoiler).map(link=>({
    id:link.topic.id,key:link.topic.key,name:link.topic.name,
    ...(includeSpoilers?{isSpoiler:link.isSpoiler}:{})
  }));
}
/** Localized public topic names; missing translations are hidden, never displayed in another language. */
export function localizedTopicSummaries(links: Array<{isSpoiler:boolean;topic:{id:string;key:string;localizations:Array<{name:string}>}}>) {
  return links.filter(link=>!link.isSpoiler && link.topic.localizations.length>0).map(link=>({
    id:link.topic.id,key:link.topic.key,name:link.topic.localizations[0].name
  }));
}
/** No answer-linked/spoiler topics in public discovery. */
export async function topicList(p: Record<string,any>) {
  const locale: Locale = p.locale;
  const q=p.q?normalizeTopicName(p.q):undefined;
  const where:Prisma.TopicWhereInput={
    localizations: {some:{locale, ...(q?{OR:[
      {name:{contains:q,mode:"insensitive"}},
      {aliases:{has:q}}
    ]}:{})}},
    quizLinks:{some:{isSpoiler:false,quiz: {
      publication:"PUBLISHED",
      ...(p.kids ? { safetyStatus:"APPROVED", kidsEligible:true } : { safetyStatus:{not:"RESTRICTED"} }),
      localizations: publishedLocalization(locale)
    }}},
  };
  const topics=await db().topic.findMany({where,
    include:{localizations:{where:{locale}}},
    orderBy:{key:"asc"},skip:p.offset,take:p.limit});
  return {items:topics.map(topic=>({id:topic.id,key:topic.key,name:topic.localizations[0].name})),
    locale,limit:p.limit,offset:p.offset};
}
