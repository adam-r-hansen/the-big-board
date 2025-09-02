export async function readApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error?.message) return String(data.error.message);
    if (typeof data === "string") return data;
  } catch {}
  return `HTTP ${res.status}`;
}
