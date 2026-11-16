const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

type ApiPayload = Record<string, unknown>;

export type AuthUser = {
    id?: string;
    full_name?: string;
    email?: string;
    role_code?: string;
    role_name?: string;
    is_active?: boolean;
};

function endpoint(path: string): string {
    if (!API_BASE_URL) {
        throw new Error("The API URL is not configured. Set NEXT_PUBLIC_API_URL in frontend/.env.local.");
    }
    return `${API_BASE_URL}${path}`;
}

async function readPayload(response: Response): Promise<ApiPayload> {
    const data: unknown = await response.json().catch(() => ({}));
    if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as ApiPayload;
    }
    return {};
}

function responseError(payload: ApiPayload, fallback: string): Error {
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
        return new Error(detail);
    }
    if (detail && typeof detail === "object" && "message" in detail) {
        const message = (detail as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) {
            return new Error(message);
        }
    }
    const message = payload.message;
    if (typeof message === "string" && message.trim()) {
        return new Error(message);
    }
    return new Error(fallback);
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
    const response = await fetch(endpoint("/auth/sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(input),
    });
    const payload = await readPayload(response);
    if (!response.ok) {
        throw responseError(payload, "Sign-in failed. Check your email and password.");
    }
}

export async function verifyIdToken(): Promise<{ user: AuthUser }> {
    const response = await fetch(endpoint("/auth/id-token/verify"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
    });
    const payload = await readPayload(response);

    if (!response.ok) {
        throw responseError(payload, "Unable to verify the sign-in identity.");
    }

    const candidate = payload.user ?? payload;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error("The ID-token response did not include a user identity.");
    }
    return { user: candidate as AuthUser };
}

// Keep one refresh request in flight per browser tab. This prevents concurrent
// 401 responses (including React Strict Mode's development effect replay) from
// attempting to rotate the same one-time refresh token more than once.
let refreshInFlight: Promise<void> | null = null;
let verifyInFlight: Promise<{ user: AuthUser }> | null = null;

async function refreshAccessToken(): Promise<void> {
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            const response = await fetch(endpoint("/auth/refresh-token"), {
                method: "POST",
                credentials: "include",
                cache: "no-store",
            });
            const payload = await readPayload(response);

            if (!response.ok) {
                throw responseError(
                    payload,
                    "Your session has expired. Please sign in again."
                );
            }
        })().finally(() => {
            refreshInFlight = null;
        });
    }

    return refreshInFlight;
}

/**
 * Fetch a protected API endpoint. If the access token has expired, all
 * concurrent callers share one refresh operation and then retry once.
 * Callers should provide replayable request bodies (for example JSON or
 * FormData), because a request that receives 401 is sent again after refresh.
 */
export async function authenticatedFetch(
    path: string,
    init: RequestInit = {}
): Promise<Response> {
    const sendRequest = () =>
        fetch(endpoint(path), {
            ...init,
            credentials: "include",
            cache: "no-store",
        });

    let response = await sendRequest();

    if (response.status === 401) {
        await refreshAccessToken();
        response = await sendRequest();
    }

    return response;
}

async function verifyTokenRequest(): Promise<{ user: AuthUser }> {
    const response = await authenticatedFetch("/auth/verify-token", {
        method: "GET",
    });
    const payload = await readPayload(response);

    if (!response.ok) {
        throw responseError(
            payload,
            "Your session is not valid. Please sign in again."
        );
    }

    const candidate = payload.user ?? payload;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error("The authentication response did not include a user identity.");
    }

    return { user: candidate as AuthUser };
}

/** Share the initial verification call as well, avoiding duplicate requests
 * when a component effect is replayed during development. */
export function verifyToken(): Promise<{ user: AuthUser }> {
    if (!verifyInFlight) {
        verifyInFlight = verifyTokenRequest().finally(() => {
            verifyInFlight = null;
        });
    }

    return verifyInFlight;
}

export async function signOut(): Promise<void> {
    // This path receives the scoped refresh cookie, so logout still works
    // when the access token has expired. No refresh rotation is needed first.
    const response = await fetch(endpoint("/auth/refresh-token/logout"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
    });
    const payload = await readPayload(response);
    if (!response.ok) {
        throw responseError(payload, "Unable to complete sign out.");
    }
}
