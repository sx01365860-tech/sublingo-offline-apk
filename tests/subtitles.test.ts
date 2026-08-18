import { describe, expect, it } from "vitest";

import { buildSrt, formatSrtTime, makeCue, upsertCue } from "../lib/subtitles";

describe("SRT helpers", () => {
  it("formats standard SRT timestamps", () => {
    expect(formatSrtTime(3_723_045)).toBe("01:02:03,045");
  });

  it("exports Vietnamese-only SRT in chronological order", () => {
    const later = { ...makeCue("后一句", 3000), translatedText: "Câu sau" };
    const earlier = { ...makeCue("第一句", 0), translatedText: "Câu đầu" };
    expect(buildSrt([later, earlier], "vi")).toContain("1\n00:00:00,000 --> 00:00:01,800\nCâu đầu");
    expect(buildSrt([later, earlier], "vi")).toContain("2\n00:00:03,000 --> 00:00:04,800\nCâu sau");
  });

  it("merges immediately repeated OCR cues", () => {
    const first = makeCue("你好", 0);
    const merged = upsertCue([first], { ...makeCue("你好", 1300), endMs: 3500 });
    expect(merged).toHaveLength(1);
    expect(merged[0].endMs).toBe(3500);
  });
});
