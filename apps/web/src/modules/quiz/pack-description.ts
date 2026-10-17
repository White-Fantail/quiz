/**
 * Existing packs sometimes append image attribution to the free-text description.
 * Move only explicitly labeled credit paragraphs into a collapsible disclosure;
 * never hide unlabeled creator prose or modify the persisted description.
 */
const imageCreditHeading = /^(?:(?:이미지|사진|미디어)\s*(?:출처|저작권|라이선스)|출처\s*(?:및|&)\s*라이선스|(?:image|photo|media)\s+(?:sources?|credits?|attributions?|licen[cs]es?)|sources?\s*(?:and|&)\s*licen[cs]es?)\s*(?:[:：—–-]|\n)/i;

export function splitPackDescription(description:string):{intro:string;imageCredits:string}{
  const intro:string[]=[];
  const credits:string[]=[];
  for(const paragraph of description.split(/\n\s*\n/)){
    const trimmed=paragraph.trim();
    if(!trimmed)continue;
    (imageCreditHeading.test(trimmed)?credits:intro).push(trimmed);
  }
  return {intro:intro.join("\n\n"),imageCredits:credits.join("\n\n")};
}
