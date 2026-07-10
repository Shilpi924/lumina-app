import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNativeApp = Capacitor.isNativePlatform();
export const isAndroidApp = Capacitor.getPlatform() === "android";
export const NativeSpeech = registerPlugin("NativeSpeech");
export const hasNativeSpeech = Capacitor.isPluginAvailable("NativeSpeech");
