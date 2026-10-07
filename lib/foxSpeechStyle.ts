/**
 * Fox speech stroke / visual style — Team Access overrides in localStorage.
 */

export type FoxSpeechStyle = {
  strokeWidthPx: number;
  strokeColor: string;
  tipFill: string;
  errorFill: string;
  infoFill: string;
  fontSizeRem: number;
  shadowStrength: number;
  wordsPerLine: number;
};

export const DEFAULT_FOX_SPEECH_STYLE: FoxSpeechStyle = {
  strokeWidthPx: 8,
  strokeColor: "#ffffff",
  tipFill: "#075473",
  errorFill: "#E60F43",
  infoFill: "#1a1510",
  fontSizeRem: 1.05,
  shadowStrength: 1,
  wordsPerLine: 4,
};

const LS_KEY = "tokio_fox_speech_style";

export function readFoxSpeechStyle(): FoxSpeechStyle {
  if (typeof window === "undefined") return DEFAULT_FOX_SPEECH_STYLE;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FOX_SPEECH_STYLE;
    const parsed = JSON.parse(raw) as Partial<FoxSpeechStyle>;
    return { ...DEFAULT_FOX_SPEECH_STYLE, ...parsed };
  } catch {
    return DEFAULT_FOX_SPEECH_STYLE;
  }
}

export function writeFoxSpeechStyle(style: FoxSpeechStyle): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(style));
    window.dispatchEvent(new Event("tokio-fox-speech-style"));
  } catch {
    /* ignore */
  }
}
