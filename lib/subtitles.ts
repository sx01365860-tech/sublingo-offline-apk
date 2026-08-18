export type CueConfidence = "high" | "medium" | "low";

export type SubtitleCue = {
  id: string;
  startMs: number;
  endMs: number;
  sourceText: string;
  translatedText: string;
  confidence: CueConfidence;
};

export type SubtitleProject = {
  id: string;
  sourceName: string;
  videoUri: string;
  size?: number;
  cropPreset: "bottom-center" | "bottom-wide" | "custom";
  status: "draft" | "processing" | "review" | "exported";
  thumbnailUri?: string;
  cues: SubtitleCue[];
  updatedAt: string;
};

export const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeSubtitleText = (text: string) =>
  text.replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

export const formatClock = (millis: number) => {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

export const formatSrtTime = (millis: number) => {
  const safe = Math.max(0, Math.round(millis));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const milliseconds = safe % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
};

export const buildSrt = (cues: SubtitleCue[], mode: "vi" | "bilingual") =>
  [...cues]
    .sort((a, b) => a.startMs - b.startMs)
    .map((cue, index) => {
      const lines = mode === "bilingual" ? [cue.sourceText, cue.translatedText].filter(Boolean) : [cue.translatedText || cue.sourceText];
      return `${index + 1}\n${formatSrtTime(cue.startMs)} --> ${formatSrtTime(cue.endMs)}\n${lines.join("\n")}`;
    })
    .join("\n\n");

export const upsertCue = (cues: SubtitleCue[], candidate: SubtitleCue) => {
  const normalized = normalizeSubtitleText(candidate.sourceText);
  if (!normalized) return cues;
  const last = cues[cues.length - 1];
  if (last && normalizeSubtitleText(last.sourceText) === normalized && candidate.startMs - last.endMs < 900) {
    return [...cues.slice(0, -1), { ...last, endMs: Math.max(last.endMs, candidate.endMs), confidence: candidate.confidence }];
  }
  return [...cues, { ...candidate, sourceText: normalized }].sort((a, b) => a.startMs - b.startMs);
};

export const makeCue = (text: string, startMs: number, confidence: CueConfidence = "medium"): SubtitleCue => ({
  id: createId("cue"),
  startMs,
  endMs: startMs + 1800,
  sourceText: normalizeSubtitleText(text),
  translatedText: "",
  confidence,
});
