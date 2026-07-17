import { execFile } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const FFMPEG = ffmpegPath as unknown as string;

function run(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      // ffmpeg writes its info log to stderr and exits 0 on success.
      if (err) reject(new Error(`ffmpeg failed: ${String(stderr).slice(-800)}`));
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** Probe duration (seconds) by asking ffmpeg to parse the container. */
export async function videoDuration(videoPath: string): Promise<number> {
  const { stderr } = await run(["-i", videoPath, "-f", "null", "-t", "0.1", "-"]).catch((e) => {
    // "-i" without output prints metadata then errors; capture anyway.
    return { stdout: "", stderr: String(e) };
  });
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
  if (!m) throw new Error("could not read video duration");
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Extract ~targetCount evenly-spaced frames at width 640, as JPEGs.
 * Returns absolute paths in timestamp order plus each frame's timestamp.
 */
export async function extractFrames(
  videoPath: string,
  outDir: string,
  targetCount = 24,
): Promise<Array<{ path: string; t: number }>> {
  await mkdir(outDir, { recursive: true });
  const duration = await videoDuration(videoPath);
  const fps = Math.max(0.2, Math.min(4, targetCount / Math.max(duration, 0.5)));
  await run([
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=${fps.toFixed(4)},scale=640:-2`,
    "-q:v",
    "3",
    path.join(outDir, "frame_%03d.jpg"),
  ]);
  const files = (await readdir(outDir)).filter((f) => f.endsWith(".jpg")).sort();
  return files.map((f, i) => ({ path: path.join(outDir, f), t: Math.round((i / fps) * 100) / 100 }));
}

/**
 * Generate a sample "vacation reel" so the demo needs no real footage:
 * three visually distinct scenes with deliberately bad exposure —
 * material the loop can visibly fix.
 */
export async function generateSampleVideo(outPath: string): Promise<string> {
  await mkdir(path.dirname(outPath), { recursive: true });
  await run([
    "-y",
    "-f", "lavfi", "-i", "testsrc2=duration=4:size=640x360:rate=30",
    "-f", "lavfi", "-i", "mandelbrot=size=640x360:rate=30",
    "-f", "lavfi", "-i", "gradients=duration=4:size=640x360:rate=30:speed=0.4",
    "-filter_complex",
    [
      "[0:v]eq=brightness=-0.28:saturation=0.9[a]", // scene 1: underexposed
      "[1:v]trim=duration=4,eq=brightness=0.18[b]", //  scene 2: overexposed mandelbrot
      "[2:v]eq=contrast=1.1[c]",
      "[a][b][c]concat=n=3:v=1:a=0[out]",
    ].join(";"),
    "-map", "[out]",
    "-pix_fmt", "yuv420p",
    outPath,
  ]);
  return outPath;
}
