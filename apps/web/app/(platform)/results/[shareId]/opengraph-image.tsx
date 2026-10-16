import { ImageResponse } from "next/og";
import { PlatformError } from "../../../../src/modules/platform/auth";
import { runShareGet } from "../../../../src/modules/platform/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "QuizDip quiz pack result";
export const size = {width:1200,height:630};
export const contentType = "image/png";

/** Korean quiz titles need explicit glyph coverage in Vercel's default Latin OG font.
 * Google Fonts returns a tiny subset restricted to the visible text. On network
 * errors, keep the image route available with the bundled font instead.
 */
async function loadKoreanFont(text:string):Promise<ArrayBuffer|null> {
  try {
    const cssUrl="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text="+
      encodeURIComponent(text.slice(0,200)+" 나의 점수 맞힌 문제 QuizDip MY QUIZ PACK RESULT SCORE PTS CORRECT ANSWERS 0123456789 Think you can beat this score?");
    const cssResponse=await fetch(cssUrl,{signal:AbortSignal.timeout(4500)});
    if(!cssResponse.ok)return null;
    const css=await cssResponse.text();
    // Only fetch files from Google's fixed font host, never an arbitrary URL.
    const resource=css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype|woff)['"]?\)/);
    const fontUrl=resource?.[1]?.replace(/['"]/g,"");
    if(fontUrl && !fontUrl.startsWith("https://fonts.gstatic.com/"))return null;
    if(!fontUrl)return null;
    const font=await fetch(fontUrl,{signal:AbortSignal.timeout(4500)});
    if(!font.ok)return null;
    const bytes=await font.arrayBuffer();
    return bytes.byteLength>0 && bytes.byteLength<1000000 ? bytes : null;
  } catch{return null;}
}

export default async function Image({params}:{params:Promise<{shareId:string}>}) {
  const {shareId}=await params;
  let result;
  try{result=await runShareGet({shareId});}
  catch(error){if(error instanceof PlatformError && error.status===404)
    return new Response("Not Found",{status:404});
    throw error;
  }
  const korean=result.locale==="ko";
  const score=new Intl.NumberFormat(korean?"ko-KR":"en-US").format(result.score);
  const koreanFont=/[가-힣]/.test(result.title) ? await loadKoreanFont(result.title) : null;
  const fonts=koreanFont?[{name:"QuizDipKorean",data:koreanFont,weight:700 as const,style:"normal" as const}]:[];
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",
      color:"#fff",background:"linear-gradient(120deg, #5044cd, #7a65ed 65%, #342385)",
      padding:"55px 68px",fontFamily:koreanFont?"QuizDipKorean":"sans-serif",justifyContent:"space-between"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{display:"flex",fontSize:42,fontWeight:800,letterSpacing:-2}}>QuizDip ●</span>
        <span style={{display:"flex",fontSize:22,opacity:.86}}>MY QUIZ PACK RESULT</span>
      </div>
      <div style={{display:"flex",fontSize:56,fontWeight:800,lineHeight:1.17,
        maxWidth:1050,overflow:"hidden",textOverflow:"ellipsis",maxHeight:151}}>
        {result.title}
      </div>
      <div style={{display:"flex",borderRadius:26,padding:"25px 38px",
        background:"#fff",color:"#251e4a",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",flexDirection:"column"}}>
          <span style={{fontSize:19,color:"#68627f"}}>{korean?"나의 점수":"MY SCORE"}</span>
          <span style={{display:"flex",alignItems:"baseline",color:"#6253de",fontSize:82,fontWeight:900}}>
            {score}<span style={{fontSize:24,marginLeft:8}}>{korean?"점":"PTS"}</span>
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          <span style={{fontSize:42,fontWeight:800}}>{result.solved} / {result.completed}</span>
          <span style={{fontSize:19,color:"#68627f"}}>{korean?"맞힌 문제":"CORRECT ANSWERS"}</span>
        </div>
      </div>
      <div style={{display:"flex",fontSize:20,justifyContent:"space-between",opacity:.90}}>
        <span>{korean?"당신도 도전해 보세요!":"Think you can beat this score?"}</span>
        <span>QuizDip</span>
      </div>
    </div>,{...size,fonts,headers:{"Cache-Control":"no-store"}});
}
