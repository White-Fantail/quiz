import type { CSSProperties } from "react";
import { spotlightRevealRadiusPercent } from "@quizdip/domain";

/** One image asset can be revealed in several ordered clue stages. */
export type RevealSettings = {
  effect:"zoom"|"spotlight"; strength:number; focusX?:number; focusY?:number;
};
export function ImageReveal({src,alt,reveal}:{src:string;alt:string;reveal:RevealSettings}) {
  const strength=Math.max(0,Math.min(100,Number.isFinite(reveal.strength)?reveal.strength:100));
  const x=Math.max(0,Math.min(100,reveal.focusX??50));
  const y=Math.max(0,Math.min(100,reveal.focusY??50));
  const style:CSSProperties={display:"block",width:"100%",height:"100%",objectFit:"contain"};
  // Unsupported historical effects show the original image without modification.
  if(reveal.effect==="zoom"){
    style.transform=`scale(${(1+strength*0.03).toFixed(2)})`;
    style.transformOrigin=`${x}% ${y}%`;
  }
  if(reveal.effect==="spotlight" && strength>0)style.clipPath=`circle(${spotlightRevealRadiusPercent(strength).toFixed(2)}% at ${x}% ${y}%)`;
  return <div className="image-reveal-frame" style={{
      width:"100%",maxWidth:640,aspectRatio:"16 / 9",background:"#15243b",overflow:"hidden",borderRadius:16
    }}>
    <img src={src} alt={alt} draggable={false} style={style}/>
  </div>;
}
