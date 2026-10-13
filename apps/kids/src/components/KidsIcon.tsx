import type { ReactNode } from "react";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from "react-native-svg";
import { theme } from "../theme";

export type KidsIconName =
  | "home" | "compass" | "book" | "puzzle" | "star" | "sparkles"
  | "dinosaur" | "lion" | "globe" | "rocket" | "search" | "paw"
  | "dice" | "trophy" | "apple" | "shield" | "lock" | "moon"
  | "family" | "child" | "target" | "phone" | "medal" | "whale" | "giraffe";

// Emoji text is not reliably supported by every iOS Simulator/Android font image.
// All decorative icons are paths/shapes, rendered by the existing react-native-svg.
const emojiIcons: Record<string, KidsIconName> = {
  "🏠": "home", "🧭": "compass", "📚": "book", "🧩": "puzzle",
  "⭐": "star", "🌟": "star", "✨": "sparkles",
  "🦕": "dinosaur", "🦁": "lion", "🌍": "globe", "🌏": "globe",
  "🚀": "rocket", "🔎": "search", "🐾": "paw", "🎲": "dice",
  "🏆": "trophy", "🍎": "apple", "🛡️": "shield", "🔒": "lock",
  "🌙": "moon", "👨‍👩‍👧": "family", "🧒": "child", "🎯": "target",
  "📱": "phone", "🏅": "medal", "🥇": "medal", "🐳": "whale",
  "🦒": "giraffe",
};

export function iconForEmoji(emoji: string): KidsIconName {
  return emojiIcons[emoji] ?? "sparkles";
}

export function KidsEmojiIcon({ emoji, size = 32, color }: { emoji: string; size?: number; color?: string }) {
  return <KidsIcon name={iconForEmoji(emoji)} size={size} color={color} />;
}

export function KidsIcon({ name, size = 32, color = theme.colors.ink }: {
  name: KidsIconName; size?: number; color?: string;
}) {
  let shape: ReactNode;
  switch (name) {
    case "home":
      shape = <><Path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><Path d="M9 21v-8h6v8"/></>;
      break;
    case "compass":
      shape = <><Circle cx="12" cy="12" r="9"/><Polygon points="15.8,8.2 13.4,13.4 8.2,15.8 10.6,10.6" fill={color} stroke="none"/></>;
      break;
    case "book":
      shape = <><Path d="M12 6c-2.8-1.8-6-2-9-1v14c3-1 6-.8 9 1 3-1.8 6-2 9-1V5c-3-1-6-.8-9 1z"/><Path d="M12 6v14M5.5 9c1.4-.2 2.7 0 4 .6M14.5 9.6c1.3-.6 2.6-.8 4-.6"/></>;
      break;
    case "puzzle":
      shape = <Path d="M9.5 3H4a1 1 0 0 0-1 1v5.5a2.5 2.5 0 1 1 0 5V20a1 1 0 0 0 1 1h5.5a2.5 2.5 0 1 1 5 0H20a1 1 0 0 0 1-1v-5.5a2.5 2.5 0 1 1 0-5V4a1 1 0 0 0-1-1h-5.5a2.5 2.5 0 1 1-5 0z"/>;
      break;
    case "star":
      shape = <Path d="m12 2.5 2.9 6 6.6 1-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-1z" fill={color} strokeWidth={1.4}/>;
      break;
    case "sparkles":
      shape = <><Path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z" fill={color} stroke="none"/><Path d="m19 2 .7 2.3L22 5l-2.3.7L19 8l-.7-2.3L16 5l2.3-.7z" fill={color} stroke="none"/></>;
      break;
    case "dinosaur":
      shape = <><Path d="M3 16c2-1 3-1 5-.8 1.5-2.3 4-2.6 6-2.2l1-6.3c.1-1.7 2-2.7 3.4-1.9l2 1.3c1 .7.7 2.3-.4 2.6l-2 .6-.3 6.3c-.2 2.9-2.4 4.4-5.3 4.4H9c-2.5 0-4-1-6-4z" fill={color} fillOpacity={0.16}/><Path d="M8 19v2M14 19v2M19 7h.1" strokeWidth={2.3} strokeLinecap="round"/></>;
      break;
    case "lion":
      shape = <><Polygon points="12,1.8 15.1,4 19,3.5 19.5,7.4 22.2,10.4 20.3,13.8 20.8,17.7 17,18.7 14.7,22 11,20.4 7.3,22 5.3,18.7 1.7,17.5 3.1,13.7 1.8,10.4 4.5,7.6 5,3.8 8.9,4" fill={color} fillOpacity={0.22}/><Circle cx="12" cy="12.5" r="6.1" fill="#FFF3DF"/><Circle cx="9.7" cy="11.7" r=".8" fill={color} stroke="none"/><Circle cx="14.3" cy="11.7" r=".8" fill={color} stroke="none"/><Path d="m10.5 14.1 1.5 1 1.5-1M12 15.2v1.6m0 0-1.4.8m1.4-.8 1.4.8"/></>;
      break;
    case "globe":
      shape = <><Circle cx="12" cy="12" r="9"/><Path d="M3 12h18M12 3c-3 2.5-4.5 5.5-4.5 9s1.5 6.5 4.5 9M12 3c3 2.5 4.5 5.5 4.5 9s-1.5 6.5-4.5 9M5 7.5h14M5 16.5h14"/></>;
      break;
    case "rocket":
      shape = <><Path d="M8 16c-.4-4 2.7-8.9 9-12l3-1-1 3c-3.1 6.3-8 9.4-12 9z" fill={color} fillOpacity={0.13}/><Path d="m8 10-3.6 1.2L2.8 16l5.2-1M14 16l-1 5.2-4.8-1.6L10 16M7.7 16.3 5 19l-.8 3.2L7.4 21l2.7-2.7"/><Circle cx="14.7" cy="9.4" r="1.6"/></>;
      break;
    case "search":
      shape = <><Circle cx="10.5" cy="10.5" r="6.7"/><Line x1="15.5" y1="15.5" x2="21" y2="21"/></>;
      break;
    case "paw":
      shape = <><Ellipse cx="12" cy="16" rx="5.8" ry="4.3" fill={color} fillOpacity={0.2}/><Ellipse cx="5" cy="10" rx="1.7" ry="2.2"/><Ellipse cx="9.5" cy="6.6" rx="1.6" ry="2.2"/><Ellipse cx="14.5" cy="6.6" rx="1.6" ry="2.2"/><Ellipse cx="19" cy="10" rx="1.7" ry="2.2"/></>;
      break;
    case "dice":
      shape = <><Rect x="3" y="3" width="18" height="18" rx="3"/>{[[8,8],[16,8],[12,12],[8,16],[16,16]].map(([cx,cy])=><Circle key={cx+":"+cy} cx={cx} cy={cy} r="1" fill={color} stroke="none"/>)}</>;
      break;
    case "trophy":
      shape = <><Path d="M7 3h10v8c0 4-2.2 6-5 6s-5-2-5-6zM7 5H3v4c0 3 2 4.5 5 4.5M17 5h4v4c0 3-2 4.5-5 4.5M12 17v4M8 21h8"/></>;
      break;
    case "apple":
      shape = <><Path d="M12 7C8 4 3 6 3.5 12.3 4 18 7.4 21 10.1 20c1.2-.5 2.6-.5 3.8 0 2.7 1 6.1-2 6.6-7.7C21 6 16 4 12 7z"/><Path d="M12 7c0-3 1-4 3-5M12 6c-1-2-3-2-4-2"/></>;
      break;
    case "shield":
      shape = <><Path d="M12 2 20 5v6c0 5.3-3 8.8-8 11-5-2.2-8-5.7-8-11V5z"/><Path d="m9 12 2 2 4-4"/></>;
      break;
    case "lock":
      shape = <><Rect x="4.5" y="10.5" width="15" height="11" rx="2"/><Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><Circle cx="12" cy="16" r="1" fill={color}/></>;
      break;
    case "moon":
      shape = <Path d="M20.5 15.5A9 9 0 0 1 8.5 3.5 9 9 0 1 0 20.5 15.5z" fill={color} fillOpacity={0.18}/>;
      break;
    case "family":
      shape = <><Circle cx="7" cy="8" r="2.6"/><Circle cx="17" cy="8" r="2.6"/><Circle cx="12" cy="14" r="2.1"/><Path d="M2 19v-2a5 5 0 0 1 7-4.6M22 19v-2a5 5 0 0 0-7-4.6M8 22v-2.1a4 4 0 0 1 8 0V22"/></>;
      break;
    case "child":
      shape = <><Circle cx="12" cy="8" r="4"/><Path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>;
      break;
    case "target":
      shape = <><Circle cx="12" cy="12" r="9"/><Circle cx="12" cy="12" r="5.5"/><Circle cx="12" cy="12" r="2" fill={color}/></>;
      break;
    case "phone":
      shape = <><Rect x="6" y="2" width="12" height="20" rx="2"/><Line x1="10" y1="18.5" x2="14" y2="18.5"/></>;
      break;
    case "medal":
      shape = <><Path d="M7 2h4l1 6 1-6h4l-2.5 9"/><Circle cx="12" cy="16" r="5.4" fill={color} fillOpacity={0.15}/><Path d="m12 13 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5L11 15z"/></>;
      break;
    case "whale":
      shape = <><Path d="M3 10c3-3 11-3 15 1 2-1 3-2 3-4 2 5 0 8-4 8-3 6-12 5-14-1-1-2-1-3 0-4z"/><Circle cx="7" cy="12" r=".7" fill={color}/><Path d="M12 8c0-2 1-2 2-3m-2 3c0-2-1-2-2-3"/></>;
      break;
    case "giraffe":
      shape = <><Path d="M8 22v-6c0-2 1-3 3-3V6L9 4l2-2 2 3 2-3 2 2-2 2v10c0 2-1 3-3 3v3M12 12h3"/><Circle cx="14.5" cy="8" r=".7" fill={color}/></>;
      break;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    accessible={false}>{shape}</Svg>;
}
