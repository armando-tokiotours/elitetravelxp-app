#!/usr/bin/env node
/**
 * Re-encode PocketBase branding videos in-place for fast mobile start.
 * Max longer edge 1280 · CRF 22 · +faststart · no audio.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STORAGE = process.argv[2] || path.join(ROOT, "backend/pb_data/storage");

function resolveFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return require("ffmpeg-static");
  } catch {
    return "ffmpeg";
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(mp4|m4v|mov)$/i.test(name) && !name.includes(".opt.tmp.")) {
      out.push(p);
    }
  }
  return out;
}

const ffmpeg = resolveFfmpeg();
const files = walk(STORAGE);
let saved = 0;

console.log(`ffmpeg: ${ffmpeg}`);
console.log(`found ${files.length} videos in ${STORAGE}`);

for (const file of files) {
  const before = fs.statSync(file).size;
  const tmp = `${file}.opt.tmp.mp4`;
  process.stdout.write(`→ ${path.basename(file)} (${Math.round(before / 1024)} KB) `);
  const r = spawnSync(
    ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-vf",
      "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "22",
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      "-an",
      tmp,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0 || !fs.existsSync(tmp)) {
    console.log("✗ failed");
    if (r.stderr) console.log(r.stderr.slice(-200));
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* */
    }
    continue;
  }
  const after = fs.statSync(tmp).size;
  if (after < before * 1.05) {
    fs.renameSync(tmp, file);
    saved += before - after;
    console.log(`✓ ${Math.round(before / 1024)} → ${Math.round(after / 1024)} KB`);
  } else {
    fs.unlinkSync(tmp);
    console.log("· skipped (no size win)");
  }
}

console.log(`Done · saved ~${Math.round(saved / 1024)} KB`);
