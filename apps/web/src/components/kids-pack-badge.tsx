/** Public Kids labeling is based solely on the platform-approved pack flag. */
export default function KidsPackBadge({eligible,locale}:{eligible?:boolean;locale:"en"|"ko"}) {
  if(!eligible)return null;
  return <span className="small-tag kids-pack-tag">
    <span aria-hidden="true">🌈</span>{locale==="ko"?"어린이용":"Kids"}
  </span>;
}
