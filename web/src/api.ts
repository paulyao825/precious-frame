import type { RunEvent } from "./types";

export async function uploadVideo(file: File): Promise<string> {
  const form = new FormData();
  form.append("video", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload failed: ${await res.text()}`);
  const { videoId } = (await res.json()) as { videoId: string };
  return videoId;
}

export async function requestSampleVideo(): Promise<string> {
  const res = await fetch("/api/sample", { method: "POST" });
  if (!res.ok) throw new Error(`sample generation failed: ${await res.text()}`);
  const { videoId } = (await res.json()) as { videoId: string };
  return videoId;
}

export async function startRun(opts: {
  videoId: string;
  n: number;
  editorBackend: "local" | "zero";
  flourish: boolean;
}): Promise<string> {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`run failed to start: ${await res.text()}`);
  const { runId } = (await res.json()) as { runId: string };
  return runId;
}

export function subscribeToRun(runId: string, onEvent: (e: RunEvent) => void): () => void {
  const source = new EventSource(`/api/runs/${runId}/events`);
  source.onmessage = (msg) => {
    const event = JSON.parse(msg.data) as RunEvent;
    onEvent(event);
    if (event.type === "run:done" || event.type === "run:error") source.close();
  };
  source.onerror = () => source.close();
  return () => source.close();
}
