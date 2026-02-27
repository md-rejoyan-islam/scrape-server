import { TWO_CAPTCHA_API_KEY } from "../config/index.js";

// ─── 2CAPTCHA API v2 ENDPOINTS ──────────────────────────────

const CREATE_TASK_URL = "https://api.2captcha.com/createTask";
const GET_RESULT_URL = "https://api.2captcha.com/getTaskResult";

// ─── TYPES ──────────────────────────────────────────────────

export interface TurnstileParams {
  websiteURL: string;
  websiteKey: string;
  /** Required for Cloudflare Challenge pages */
  action?: string;
  /** Required for Cloudflare Challenge pages (cData) */
  data?: string;
  /** Required for Cloudflare Challenge pages (chlPageData) */
  pagedata?: string;
}

export interface TurnstileSolution {
  token: string;
  userAgent: string;
}

// ─── HELPERS ────────────────────────────────────────────────

async function createTask(params: TurnstileParams): Promise<string> {
  const task: Record<string, string> = {
    type: "TurnstileTaskProxyless",
    websiteURL: params.websiteURL,
    websiteKey: params.websiteKey,
  };

  // Add optional params for Cloudflare Challenge pages
  if (params.action) task.action = params.action;
  if (params.data) task.data = params.data;
  if (params.pagedata) task.pagedata = params.pagedata;

  const body = {
    clientKey: TWO_CAPTCHA_API_KEY,
    task,
  };

  console.log(
    `[captcha-solver] Sending Turnstile task to 2Captcha (sitekey: ${params.websiteKey.substring(0, 12)}...)`,
  );

  const res = await fetch(CREATE_TASK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    errorId: number;
    errorCode?: string;
    errorDescription?: string;
    taskId?: number;
  };

  if (json.errorId !== 0) {
    throw new Error(
      `[captcha-solver] createTask failed: ${json.errorCode} — ${json.errorDescription}`,
    );
  }

  const taskId = String(json.taskId);
  console.log(`[captcha-solver] Task created: ${taskId}`);
  return taskId;
}

async function getTaskResult(taskId: string): Promise<TurnstileSolution> {
  const POLL_INTERVAL_MS = 5_000;
  const MAX_POLLS = 24; // 24 × 5s = 120s max

  for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    console.log(
      `[captcha-solver] Polling for result... (attempt ${attempt}/${MAX_POLLS})`,
    );

    const res = await fetch(GET_RESULT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: TWO_CAPTCHA_API_KEY,
        taskId: Number(taskId),
      }),
    });

    const json = (await res.json()) as {
      errorId: number;
      errorCode?: string;
      errorDescription?: string;
      status: string;
      solution?: {
        token: string;
        userAgent: string;
      };
      cost?: string;
    };

    if (json.errorId !== 0) {
      throw new Error(
        `[captcha-solver] getTaskResult error: ${json.errorCode} — ${json.errorDescription}`,
      );
    }

    if (json.status === "ready" && json.solution) {
      console.log(
        `[captcha-solver] ✅ Turnstile solved! (cost: ${json.cost || "?"})`,
      );
      return {
        token: json.solution.token,
        userAgent: json.solution.userAgent,
      };
    }

    // status === "processing" → keep polling
  }

  throw new Error("[captcha-solver] Timed out waiting for 2Captcha solution");
}

// ─── PUBLIC API ─────────────────────────────────────────────

/**
 * Solve a Cloudflare Turnstile captcha using the 2Captcha service.
 *
 * Supports both standalone Turnstile widgets and Cloudflare Challenge pages.
 * For challenge pages, pass `action`, `data`, and `pagedata` parameters.
 *
 * @throws if API key is not configured, or solving fails/times out
 */
export async function solveTurnstile(
  params: TurnstileParams,
): Promise<TurnstileSolution> {
  if (!TWO_CAPTCHA_API_KEY) {
    throw new Error("[captcha-solver] TWO_CAPTCHA_API_KEY is not configured");
  }

  const taskId = await createTask(params);
  return getTaskResult(taskId);
}
