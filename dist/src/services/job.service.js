// ─── IN-MEMORY JOB STORE ────────────────────────────────────
const jobs = new Map();
export function createJob(jobId, url, batchId) {
    jobs.set(jobId, {
        status: "running",
        createdAt: new Date().toISOString(),
        url,
        ...(batchId && { batchId }),
    });
}
export function completeJob(jobId, data) {
    const existing = jobs.get(jobId);
    if (!existing)
        return;
    jobs.set(jobId, {
        ...existing,
        status: "completed",
        data,
        completedAt: new Date().toISOString(),
    });
}
export function failJob(jobId, errorMessage) {
    const existing = jobs.get(jobId);
    if (!existing)
        return;
    jobs.set(jobId, {
        ...existing,
        status: "failed",
        error: errorMessage,
        completedAt: new Date().toISOString(),
    });
}
export function getJob(jobId) {
    return jobs.get(jobId);
}
export function getAllJobs() {
    const list = [];
    jobs.forEach((value, key) => {
        list.push({ jobId: key, ...value, data: undefined });
    });
    return list;
}
