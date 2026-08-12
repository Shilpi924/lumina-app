import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNativeApp = Capacitor.isNativePlatform() || (typeof window !== "undefined" && !!window.isNativeAppMock);
export const isAndroidApp = Capacitor.getPlatform() === "android" || (typeof window !== "undefined" && !!window.isAndroidAppMock);
export const NativeSpeech = registerPlugin("NativeSpeech");
export const hasNativeSpeech = Capacitor.isPluginAvailable("NativeSpeech");
