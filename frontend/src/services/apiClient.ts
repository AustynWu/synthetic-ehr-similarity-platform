// apiClient.ts — centralized HTTP client for backend communication
//
// Why this file exists:
//   Every service (dataset, evaluation, comparison) needs to talk to the backend.
//   Instead of writing the same fetch() code three times, we put it here once.
//   Each service imports these helpers so they all behave the same way.
//
// How to enable real API (currently OFF by default):
//   Create frontend/.env.local and add:
//     VITE_USE_REAL_API=true
//     VITE_API_BASE_URL=http://localhost:8000
//
// When VITE_USE_REAL_API is false (or not set), all services use mock data instead.
// Mock data is never deleted — it is always available as the safe fallback.

// Why import.meta.env?
//   Vite reads .env.local at build time and replaces import.meta.env.XXX with the actual value.
//   Only variables starting with VITE_ are exposed to frontend code (for security reasons).
//   The ?? operator means: "if the left side is null or undefined, use the right side instead."
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Why export this flag?
//   Each service file needs to know whether to call the real API or return mock data.
//   We read the env variable once here and share it, so every service stays in sync.
//   === "true" is needed because env variables are always strings, not booleans.
export const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === "true";


// Why use generics (<T>)?
//   Different endpoints return different data shapes (e.g. UploadedDatasets, ValidationSummary).
//   The <T> lets the caller say "this call returns THIS type", so TypeScript can check it.
//   Without generics, we would have to write a separate fetch function for every response type.


// GET request — reads data from the backend, expects a JSON response back.
// path: the URL path after the base URL, e.g. "/metrics" → http://localhost:8000/metrics
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);

  // Why check res.ok?
  //   fetch() does NOT throw an error when the server returns 404 or 500 — it just gives
  //   us a response with ok=false. We must check manually and throw to signal failure.
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);

  // res.json() reads the response body and converts the JSON text into a JavaScript object.
  // "as Promise<T>" tells TypeScript to trust us that the shape matches T.
  return res.json() as Promise<T>;
}


// POST request with a JSON body — sends data to the backend and expects JSON back.
// body: unknown means we accept any value; JSON.stringify converts it to a JSON string.
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",

    // Why "Content-Type": "application/json"?
    //   This tells the server that the request body is JSON, not a form or a file.
    //   Without this header, FastAPI would not know how to parse the body.
    headers: { "Content-Type": "application/json" },

    // JSON.stringify turns the JavaScript object into a JSON string for the network.
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}


// POST with multipart/form-data — the correct way to send files over HTTP.
// FormData is a browser built-in that packages files and text fields together.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",

    // Why NOT set Content-Type here?
    //   When sending a FormData, the browser must add a "boundary" string to the header
    //   (e.g. Content-Type: multipart/form-data; boundary=----XYZ123).
    //   If we manually set Content-Type, we overwrite that boundary and the server
    //   cannot split the file parts correctly. So we let the browser set it automatically.
    body: formData,
  });

  if (!res.ok) throw new Error(`POST ${path} (upload) failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
