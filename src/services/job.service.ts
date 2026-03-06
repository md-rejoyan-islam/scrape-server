import type { Job, ScrapeResult } from "../types/index.js";

// ─── IN-MEMORY JOB STORE ────────────────────────────────────

const jobs = new Map<string, Job>();

export function createJob(jobId: string, url: string, batchId?: string): void {
  jobs.set(jobId, {
    status: "running",
    createdAt: new Date().toISOString(),
    url,
    ...(batchId && { batchId }),
  });
}

export function completeJob(jobId: string, data: ScrapeResult): void {
  const existing = jobs.get(jobId);
  if (!existing) return;

  jobs.set(jobId, {
    ...existing,
    status: "completed",
    data,
    completedAt: new Date().toISOString(),
  });
}

export function failJob(jobId: string, errorMessage: string): void {
  const existing = jobs.get(jobId);
  if (!existing) return;

  jobs.set(jobId, {
    ...existing,
    status: "failed",
    error: errorMessage,
    completedAt: new Date().toISOString(),
  });
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function getAllJobs(): Record<string, unknown>[] {
  const list: Record<string, unknown>[] = [];
  jobs.forEach((value, key) => {
    list.push({ jobId: key, ...value, data: undefined });
  });
  return list;
}
