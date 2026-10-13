import Svg,{Circle,Ellipse,G,Path,Rect,Polygon} from "react-native-svg";

/** Original, font-independent chest illustration for the private Kids rewards screen. */
export function TreasureChestArtwork({size=180}:{size?:number}){
 return <Svg width={size} height={size} viewBox="0 0 180 154" accessible={false}>
  <Circle cx="89" cy="73" r="66" fill="#FFFFFF" opacity={0.16}/>
  <Circle cx="26" cy="44" r="5" fill="#FFDA76"/>
  <Circle cx="149" cy="29" r="7" fill="#FFE89D"/>
  <Polygon points="151,68 155,79 166,83 155,87 151,98 147,87 136,83 147,79" fill="#FFF3BB"/>
  <Path d="M38 66q0-42 52-42t52 42v17H38Z" fill="#FFBE68"/>
  <Path d="M38 66q0-42 52-42t52 42v6H38Z" fill="#F9D58C"/>
  <Path d="M45 69q1-37 45-37t45 37" fill="none" stroke="#B46C49" strokeWidth="6"/>
  <Rect x="29" y="71" width="121" height="63" rx="14" fill="#CE8E62"/>
  <Rect x="29" y="71" width="121" height="21" rx="8" fill="#FFBC67"/>
  <Rect x="29" y="89" width="121" height="45" rx="10" fill="#D88C56"/>
  <Path d="M44 96v25M136 96v25" stroke="#F6C27C" strokeWidth="7" strokeLinecap="round"/>
  <Path d="M71 72h38v53H71Z" fill="#FFDB7A"/>
  <Rect x="72" y="87" width="36" height="36" rx="9" fill="#FFF0BC"/>
  <Circle cx="90" cy="103" r="10" fill="#8052C9"/>
  <Circle cx="90" cy="102" r="3" fill="#FFE8A2"/>
  <Ellipse cx="90" cy="142" rx="67" ry="7" fill="#46217F" opacity={0.16}/>
  <Polygon points="45,17 49,28 60,32 49,36 45,47 41,36 30,32 41,28" fill="#FFD975"/>
  <Polygon points="113,4 116,13 125,16 116,19 113,28 110,19 101,16 110,13" fill="#FFFFFF"/>
 </Svg>;
}
