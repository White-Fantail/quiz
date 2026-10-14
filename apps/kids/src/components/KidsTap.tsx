import { Pressable, type PressableProps } from "react-native";

/**
 * Immediate visual touch acknowledgement on both iPad and Android.
 * No remote request or animation work is needed before the press is shown.
 * Keep disabled controls visibly disabled, including during API requests.
 */
export function KidsTap({style,android_ripple,hitSlop,disabled,...props}:PressableProps) {
 return <Pressable {...props} disabled={disabled}
   hitSlop={hitSlop??6}
   android_ripple={android_ripple??{color:"#6D43D922"}}
   style={state=>[
     typeof style==="function"?style(state):style,
     disabled?{opacity:0.55}:state.pressed?{opacity:0.8,transform:[{scale:0.975}]}:undefined,
   ]}/>;
}
