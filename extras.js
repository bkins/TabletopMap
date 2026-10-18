export const atmosphereDefaults=()=>({effect:'none',sound:'none',volume:0.2});
export const compassDefaults=()=>({enabled:false,rotation:0});
export function validateCompass(c){if(!c||typeof c.enabled!=='boolean'||typeof c.rotation!=='number'||!Number.isFinite(c.rotation)||c.rotation< -360||c.rotation>360)throw Error('Invalid compass settings');return {enabled:c.enabled,rotation:((c.rotation%360)+360)%360};}
export function validateAtmosphere(a){if(!a||!['none','rain','embers','mist'].includes(a.effect)||!['none','rain','fire','wind','cavern'].includes(a.sound)||typeof a.volume!=='number'||!Number.isFinite(a.volume)||a.volume<0||a.volume>1)throw Error('Invalid atmosphere settings');return a;}
