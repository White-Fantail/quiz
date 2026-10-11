export type TopicInput = string | { name: string; isSpoiler?: boolean };
export type QuizAnswer = { canonical: string; aliases?: string[] };
export function normalizeTopicName(v: string): string { return v.normalize("NFKC").trim().replace(/\s+/gu," "); }
export function normalizeTopicKey(v: string): string { return normalizeTopicName(v).toLocaleLowerCase(); }
export function normalizeTopicInputs(inputs: TopicInput[], answer: QuizAnswer) {
  const answers = [answer.canonical,...(answer.aliases??[])].map(normalizeTopicKey).filter(Boolean);
  const unique = new Map<string,{key:string;name:string;isSpoiler:boolean}>();
  for(const input of inputs) {
    const name=normalizeTopicName(typeof input==="string"?input:input.name);
    const key=normalizeTopicKey(name);
    if(!key||name.length>80) throw new Error("Invalid topic");
    const creatorSpoiler=typeof input!=="string" && input.isSpoiler===true;
    const isSpoiler=creatorSpoiler||answers.some(a=>a===key||(a.length>=3&&key.includes(a)));
    const previous=unique.get(key);
    if(previous) previous.isSpoiler ||= isSpoiler;
    else unique.set(key,{key,name,isSpoiler});
  }
  return [...unique.values()];
}
