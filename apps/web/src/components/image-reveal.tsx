/** One image asset can be revealed in several ordered clue stages. */
export type RevealSettings = {
  effect:"blur"|"zoom"|"spotlight"; strength:number; focusX?:number; focusY?:number;
};
export type RevealItem = {type:string;mediaId?:string};
/** Keep one active image on screen as progressively clearer stages unlock. */
export function supersededReveal(clues:RevealItem[],index:number):boolean {
  const clue=clues[index];
  return clue?.type==="image-reveal" && !!clue.mediaId &&
    clues.slice(index+1).some(next=>next.type==="image-reveal"&&next.mediaId===clue.mediaId);
}
export function ImageReveal({src,alt,reveal}:{src:string;alt:string;reveal:RevealSettings}) {
  const strength=Math.max(0,Math.min(100,Number.isFinite(reveal.strength)?reveal.strength:100));
  const x=Math.max(0,Math.min(100,reveal.focusX??50));
  const y=Math.max(0,Math.min(100,reveal.focusY??50));
  const style:React.CSSProperties={display:"block",width:"100%",height:"100%",objectFit:"contain"};
  if(reveal.effect==="blur")style.filter=`blur(${(strength*0.3).toFixed(1)}px)`;
  if(reveal.effect==="zoom"){
    style.transform=`scale(${(1+strength*0.03).toFixed(2)})`;
    style.transformOrigin=`${x}% ${y}%`;
  }
  if(reveal.effect==="spotlight")style.clipPath=`circle(${(100-strength*0.9).toFixed(1)}% at ${x}% ${y}%)`;
  return <div className="image-reveal-frame" style={{
      width:"100%",maxWidth:640,aspectRatio:"16 / 9",background:"#15243b",overflow:"hidden",borderRadius:16
    }}>
    <img src={src} alt={alt} draggable={false} style={style}/>
  </div>;
}
