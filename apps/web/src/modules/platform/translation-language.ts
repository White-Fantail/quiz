/** Conservative hints only: no automatic language classification for mixed/ambiguous content. */
export type ContentLocale = "en"|"ko"|"und";
export function detectContentLocale(value:string):ContentLocale {
  const korean=(value.match(/[\uAC00-\uD7A3]/gu)||[]).length;
  const latin=(value.match(/[A-Za-z]/gu)||[]).length;
  if(korean>=6 && korean>=latin/4) return "ko";
  if(latin>=15 && korean===0) return "en";
  return "und";
}
export function detectQuizLocale(value:{title:string;prompt:string;clues:Array<{text?:string}>}):ContentLocale {
  // Proper nouns in a title/answer can be in a different language, so base inference on prompt/clues.
  return detectContentLocale([value.prompt,...value.clues.map(c=>c.text??"")].join("\n"));
}
