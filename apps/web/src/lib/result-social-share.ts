/** Only public result links have the score-card Open Graph preview. */
export type ResultSocialTarget = "facebook" | "x";

/** Never fall back to a pack URL when sharing a personal result. */
export function publicResultSharePayload(
  site: ResultSocialTarget,
  resultUrl: string,
  title: string,
  shareText: string,
): ShareData {
  let parsed: URL;
  try {
    parsed = new URL(resultUrl);
  } catch {
    throw new Error("A public result link must be prepared before sharing.");
  }
  if (!["https:", "http:"].includes(parsed.protocol) ||
      !/^\/(en|ko)\/results\/[^/]+\/?$/.test(parsed.pathname)) {
    throw new Error("Only a public QuizDip result link can be shared.");
  }

  // iOS Facebook is more reliable with a URL-only share payload;
  // Facebook builds the title, description and image from the OG tags.
  return site === "facebook"
    ? { url: parsed.href }
    : { title: title + " · QuizDip", text: shareText, url: parsed.href };
}
