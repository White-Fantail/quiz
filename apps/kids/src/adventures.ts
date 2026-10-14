import type { KidPackItem, KidsCatalogItem } from "@quizdip/api-client";
import type { KidsMessageKey } from "@quizdip/i18n/kids";

export type AdventureId =
  | "dinosaur" | "animals" | "space" | "math" | "patterns"
  | "time" | "world" | "things" | "science" | "surprise";

export type Adventure = {
  id: AdventureId;
  emoji: string;
  tint: string;
  labelKey: KidsMessageKey;
  detailKey: KidsMessageKey;
};

// One set of adventure identifiers and labels powers Play, All Worlds and pack discovery.
// These are presentation groups, never child-safety or approval decisions.
export const adventures: readonly Adventure[] = [
  {id:"dinosaur",emoji:"🦕",tint:"#E9DEFF",labelKey:"native.adventure.dinosaur",detailKey:"native.adventure.dinosaurDesc"},
  {id:"animals",emoji:"🦁",tint:"#FFE0C7",labelKey:"native.adventure.animals",detailKey:"native.adventure.animalsDesc"},
  {id:"space",emoji:"🚀",tint:"#D9EAFE",labelKey:"native.adventure.space",detailKey:"native.adventure.spaceDesc"},
  {id:"math",emoji:"🍎",tint:"#FFE8A6",labelKey:"native.adventure.math",detailKey:"native.adventure.mathDesc"},
  {id:"patterns",emoji:"🧩",tint:"#FFDCE9",labelKey:"native.adventure.patterns",detailKey:"native.adventure.patternsDesc"},
  {id:"time",emoji:"⏱",tint:"#CAF2E9",labelKey:"native.adventure.time",detailKey:"native.adventure.timeDesc"},
  {id:"world",emoji:"🌍",tint:"#D5F4CF",labelKey:"native.adventure.world",detailKey:"native.adventure.worldDesc"},
  {id:"things",emoji:"🔎",tint:"#FFE5D2",labelKey:"native.adventure.things",detailKey:"native.adventure.thingsDesc"},
  {id:"science",emoji:"✨",tint:"#E3E8FF",labelKey:"native.adventure.science",detailKey:"native.adventure.scienceDesc"},
  {id:"surprise",emoji:"⭐",tint:"#F4E5FF",labelKey:"native.adventure.surprise",detailKey:"native.adventure.surpriseDesc"},
];

const words: {id:AdventureId; terms:readonly string[]}[] = [
  {id:"dinosaur",terms:["dinosaur","dinosaurs","dino","tyrannosaurus","triceratops","jurassic","공룡","티라노","트리케라"]},
  {id:"patterns",terms:["pattern","patterns","what comes next","sequence","sequences","shapes","shape","matching patterns","패턴","규칙","도형","다음에 올","순서 찾기"]},
  {id:"time",terms:["tell the time","telling time","read the clock","clock","clocks","what time","o'clock","minutes","hour","시간 읽기","시계","몇 시","몇시"]},
  {id:"math",terms:["math","maths","addition","subtraction","counting","numbers","number","plus","minus","arithmetic","덧셈","뺄셈","수학","숫자","세어","계산"]},
  {id:"space",terms:["solar system","planet","planets","space","galaxy","rocket","saturn","mercury","mars","neptune","우주","행성","태양계","로켓"]},
  {id:"animals",terms:["animal","animals","wildlife","jungle","safari","pets","puppies","whale","shark","lion","giraffe","동물","사파리","고양이","강아지","고래","상어"]},
  {id:"world",terms:["countries","country","capital city","landmark","world","geography","places","place","지도","나라","세계","도시","국가","장소"]},
  {id:"things",terms:["fruit","fruits","vegetables","vegetable","food","foods","objects","object","things","household","과일","채소","음식","물건","사물"]},
  {id:"science",terms:["science","experiment","nature","weather","과학","실험","자연","날씨"]},
];

// English matches word boundaries so "time" does not match "sometimes".
// Korean words can attach to particles, so use substring matching.
function contains(text:string,term:string):boolean {
  if (/^[a-z]/.test(term))
    return new RegExp("(^|[^a-z])"+term+"(?=$|[^a-z])","i").test(text);
  return text.includes(term);
}
function matchText(text:string):AdventureId|null {
  const lower=text.toLowerCase();
  for(const entry of words) if(entry.terms.some(term=>contains(lower,term))) return entry.id;
  return null;
}
export function adventureForPack(pack:Pick<KidPackItem,"title"|"description">):AdventureId {
  return matchText(pack.title+" "+pack.description)||"surprise";
}
export function adventureForQuiz(quiz:Pick<KidsCatalogItem,"title"|"prompt"|"answerType">):AdventureId {
  const direct=matchText(quiz.title+" "+quiz.prompt);
  if(direct)return direct;
  switch(quiz.answerType) {
    case "animal":return "animals";
    case "place":return "world";
    case "concept":return "science";
    case "thing":return "things";
    default:return "surprise";
  }
}
export function adventureById(id:string|undefined):Adventure|null {
  return adventures.find(item=>item.id===id)||null;
}
export function adventureCount(id:AdventureId,packs:KidPackItem[],quizzes:KidsCatalogItem[]):number {
  // Count a pack once. Its constituent questions aren't additional games.
  return packs.filter(item=>adventureForPack(item)===id).length;
}
