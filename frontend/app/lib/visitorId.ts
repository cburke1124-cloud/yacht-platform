const STORAGE_KEY = 'yv_visitor_id';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Anonymous per-browser id sent with token-spending requests (AI search,
 *  chatbot) so the backend can enforce guest limits even if the IP changes. */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function visitorHeaders(): Record<string, string> {
  const id = getVisitorId();
  return id ? { 'X-Visitor-Id': id } : {};
}

export function newSessionId(): string {
  return randomId();
}

/** Shape of the backend's AI rejections: usage limit (HTTP 429) or the AI
 *  being unavailable (HTTP 503, e.g. provider outage / exhausted credit). */
export interface AIQuotaError {
  message: string;
  signupRequired: boolean;
  /** AI is down: offer the "leave us a message" form instead. */
  unavailable: boolean;
}

/** Returns the AI limit/unavailable error if `res` is one of those responses. */
export async function readAIQuotaError(res: Response): Promise<AIQuotaError | null> {
  if (res.status !== 429 && res.status !== 503) return null;
  try {
    const data = await res.clone().json();
    if (data?.details?.code) {
      return {
        message: data.detail || data.error || 'AI search is unavailable right now.',
        signupRequired: !!data.details.signup_required,
        unavailable: data.details.code === 'ai_unavailable',
      };
    }
  } catch {
    /* not our quota response (e.g. generic rate limit) */
  }
  return null;
}
