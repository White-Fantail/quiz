import Svg,{Circle,Ellipse,G,Path,Polygon,Rect} from "react-native-svg";
import type {AdventureId} from "../adventures";

// Original, self-contained vector scenes (no emoji fonts or external assets).
// Large silhouettes, expressive faces and bright props make categories readable
// to pre-readers on both iPad and small phones.
export function AdventureArtwork({id,size=142}:{id:AdventureId;size?:number}) {
 const face=<><Circle cx="92" cy="53" r="3.5" fill="#31234A"/><Circle cx="93" cy="52" r="1" fill="white"/></>;
 return <Svg width={size} height={size} viewBox="0 0 150 130" accessible={false}>
  <Circle cx="109" cy="61" r="56" fill="#FFFFFF" opacity={0.23}/>
  <Circle cx="35" cy="25" r="10" fill="#FFFFFF" opacity={0.42}/>
  <Circle cx="22" cy="102" r="7" fill="#FFFFFF" opacity={0.38}/>
  {id==="dinosaur"?<G>
   <Ellipse cx="70" cy="109" rx="46" ry="6" fill="#6546A0" opacity={0.13}/>
   <Path d="M48 77 16 63Q28 96 53 96Z" fill="#32996E"/>
   <Ellipse cx="75" cy="77" rx="44" ry="31" fill="#41BD87"/>
   <Path d="M92 72Q98 40 106 26Q115 16 126 31L127 69Q122 88 100 87Z" fill="#41BD87"/>
   <Ellipse cx="117" cy="49" rx="19" ry="22" fill="#52D69C"/>
   <Polygon points="44,60 51,41 62,57" fill="#F9B46B"/>
   <Polygon points="59,50 72,30 80,49" fill="#F9B46B"/>
   <Polygon points="78,49 91,32 99,55" fill="#F9B46B"/>
   <Rect x="50" y="92" width="16" height="17" rx="7" fill="#2D966E"/>
   <Rect x="89" y="92" width="16" height="17" rx="7" fill="#2D966E"/>
   <Circle cx="112" cy="43" r="3.7" fill="#283A4E"/><Circle cx="113" cy="42" r="1.1" fill="white"/>
   <Circle cx="119" cy="67" r="8" fill="#FFAD9D" opacity="0.7"/>
   <Path d="M121 56q6 7 13 0" fill="none" stroke="#23563F" strokeWidth="2.7" strokeLinecap="round"/>
   <Circle cx="65" cy="72" r="6" fill="#9BE9BB"/><Circle cx="81" cy="89" r="4" fill="#9BE9BB"/>
  </G>:null}
  {id==="animals"?<G>
    <Ellipse cx="74" cy="114" rx="43" ry="6" fill="#BD744B" opacity=".15"/>
    <Circle cx="78" cy="69" r="48" fill="#CE7A39"/>
    <Circle cx="45" cy="36" r="17" fill="#C36D32"/><Circle cx="111" cy="36" r="17" fill="#C36D32"/>
    <Circle cx="78" cy="73" r="36" fill="#FFC66B"/>
    <Ellipse cx="78" cy="89" rx="22" ry="15" fill="#FFE8B5"/>
    <Circle cx="65" cy="68" r="4.2" fill="#49304B"/><Circle cx="90" cy="68" r="4.2" fill="#49304B"/>
    <Path d="M73 85Q78 81 83 85L78 91Z" fill="#49304B"/>
    <Path d="M78 91q-8 8-14 0M78 91q8 8 14 0" stroke="#49304B" fill="none" strokeWidth="2.5" strokeLinecap="round"/>
    <Circle cx="52" cy="81" r="8" fill="#F9A497" opacity=".6"/><Circle cx="104" cy="81" r="8" fill="#F9A497" opacity=".6"/>
  </G>:null}
  {id==="space"?<G>
    <Path d="M73 91Q67 60 105 20Q118 44 108 72L89 93Z" fill="#FFF7ED"/>
    <Path d="M88 89Q71 76 62 88L55 108 79 99Z" fill="#F98491"/>
    <Path d="M105 73Q121 78 128 88L111 101 92 91Z" fill="#FFB0A1"/>
    <Circle cx="95" cy="57" r="13" fill="#5CCFE5"/><Circle cx="95" cy="57" r="8" fill="#B7F4F7"/>
    <Path d="M78 96 79 113 88 101Z" fill="#FEC652"/>
    <Path d="M86 98 93 122 100 100Z" fill="#FF9074"/>
    <Circle cx="38" cy="42" r="9" fill="#FFE385"/>
    <Polygon points="32,71 35,80 44,83 35,86 32,95 29,86 20,83 29,80" fill="#FFFFFF"/>
    <Circle cx="121" cy="23" r="5" fill="#FFD98B"/>
  </G>:null}
  {id==="math"?<G>
    <Rect x="24" y="64" width="49" height="47" rx="13" fill="#F17F7C"/>
    <Rect x="76" y="41" width="50" height="70" rx="13" fill="#68C4AE"/>
    <Circle cx="49" cy="79" r="6" fill="white"/><Circle cx="49" cy="96" r="6" fill="white"/>
    <Circle cx="94" cy="66" r="5" fill="white"/><Circle cx="109" cy="66" r="5" fill="white"/>
    <Circle cx="94" cy="83" r="5" fill="white"/><Circle cx="109" cy="83" r="5" fill="white"/>
    <Path d="M38 48h24M50 36v24" stroke="#7054A5" strokeWidth="7" strokeLinecap="round"/>
    <Circle cx="107" cy="30" r="10" fill="#FFDA76"/>
  </G>:null}
  {id==="patterns"?<G>
    <Circle cx="39" cy="51" r="21" fill="#EF7899"/>
    <Rect x="70" y="31" width="39" height="39" rx="8" fill="#69C1E5"/>
    <Polygon points="44,105 64,74 85,105" fill="#FFD66E"/>
    <Circle cx="111" cy="94" r="19" fill="#9E7CED"/>
    <Circle cx="36" cy="46" r="4" fill="white"/><Circle cx="46" cy="46" r="4" fill="white"/>
    <Path d="M36 56q7 9 14 0" stroke="white" strokeWidth="2" fill="none"/>
    <Path d="M82 51h15M89 43v16" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <Polygon points="105,89 116,89 110,101" fill="white"/>
  </G>:null}
  {id==="time"?<G>
    <Path d="M49 38 35 22M102 38l14-16" stroke="#42A8A0" strokeWidth="12" strokeLinecap="round"/>
    <Circle cx="75" cy="73" r="45" fill="#58C6B6" stroke="#239D93" strokeWidth="5"/>
    <Circle cx="75" cy="73" r="35" fill="#FFFDF6"/>
    <Path d="M75 45v5M75 96v5M47 73h5M98 73h5" stroke="#5B4A71" strokeWidth="3.5" strokeLinecap="round"/>
    <Path d="M75 52v22l16 11" stroke="#54416A" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Circle cx="75" cy="73" r="5" fill="#FF8E7A"/>
    <Circle cx="64" cy="62" r="2" fill="#5B4A71"/><Circle cx="87" cy="62" r="2" fill="#5B4A71"/>
    <Path d="M67 88q8 8 16 0" fill="none" stroke="#FF9A8B" strokeWidth="2.5" strokeLinecap="round"/>
  </G>:null}
  {id==="world"?<G>
    <Circle cx="77" cy="68" r="47" fill="#5BC6DD"/>
    <Path d="M54 26 43 42 53 59 68 54 73 69 92 61 88 40 71 34Z" fill="#52B985"/>
    <Path d="M83 79 99 71 117 87 98 105 87 113 76 98Z" fill="#52B985"/>
    <Path d="M34 77 51 84 55 102 41 92Z" fill="#52B985"/>
    <Path d="M35 67h84M77 20c-30 29-30 68 0 95M77 20c30 29 30 68 0 95" stroke="#FFFFFF" strokeOpacity=".34" strokeWidth="2" fill="none"/>
    <Circle cx="108" cy="32" r="9" fill="#FFE7A5"/>
  </G>:null}
  {id==="things"?<G>
    <Path d="M79 51Q52 32 37 57 22 87 45 108 61 122 80 109 102 122 114 102 135 65 110 52 94 43 79 51Z" fill="#F78878"/>
    <Path d="M78 52Q72 26 91 19" stroke="#76513F" strokeWidth="6" strokeLinecap="round"/>
    <Path d="M86 38Q99 19 117 29 100 43 86 38" fill="#5FBA80"/>
    <Circle cx="58" cy="76" r="6" fill="white" opacity=".32"/>
    <Circle cx="111" cy="33" r="7" fill="#FFD469"/>
  </G>:null}
  {id==="science"?<G>
    <Path d="M60 20h31M69 20v44L42 103q-3 9 7 9h60q10 0 7-9L86 64V20" stroke="#6E55A3" strokeWidth="6" fill="#FFFDF7" strokeLinejoin="round"/>
    <Path d="M55 89q25 13 49 0l10 19H45Z" fill="#73D7C8"/>
    <Circle cx="73" cy="91" r="6" fill="#A16EEE"/><Circle cx="90" cy="101" r="4" fill="#FFB86A"/>
    <Circle cx="110" cy="34" r="9" fill="#FFD974"/><Circle cx="37" cy="66" r="6" fill="#F593B6"/>
  </G>:null}
  {id==="surprise"?<G>
    <Rect x="31" y="55" width="91" height="58" rx="12" fill="#9B78E1"/>
    <Rect x="24" y="49" width="105" height="22" rx="8" fill="#B99BF2"/>
    <Rect x="68" y="49" width="15" height="64" rx="3" fill="#FFD981"/>
    <Path d="M76 49q-39-5-28-25 12-16 28 25m0 0q39-5 28-25-12-16-28 25" fill="none" stroke="#F7C45B" strokeWidth="8" strokeLinecap="round"/>
    <Circle cx="111" cy="22" r="7" fill="#FFD981"/>
  </G>:null}
 </Svg>;
}
