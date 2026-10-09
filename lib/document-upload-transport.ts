/** Bounded TUS transport. Persist only its location; fresh actor/signed tokens stay in memory. */
export async function uploadDocumentResumable(
  data: Record<string, unknown>,
  file: File,
  progress: (p: number) => void,
  resume: string | undefined,
  remember: (location: string) => void,
) {
  const endpoint = new URL(String(data.endpoint));
  const checked = (location: string) => {
    const u = new URL(location, endpoint);
    if (
      u.origin !== endpoint.origin ||
      !u.pathname.startsWith(endpoint.pathname + "/") ||
      u.username ||
      u.password
    )
      throw Error("Unexpected upload destination.");
    return u;
  };
  const headers = {
    "Tus-Resumable": "1.0.0",
    "x-signature": String(data.token),
    apikey: String(data.apikey),
    Authorization: `Bearer ${data.access_token}`,
  };
  const request = (url: string | URL, options: RequestInit) =>
    fetch(url, {
      ...options,
      signal: AbortSignal.timeout(options.method === "PATCH" ? 120000 : 15000),
    });
  let url: URL | undefined,
    offset = 0;
  if (resume) {
    url = checked(resume);
    const head = await request(url, { method: "HEAD", headers });
    if (head.ok) {
      offset = Number(head.headers.get("Upload-Offset"));
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size)
        throw Error("Invalid upload checkpoint. Retry safely.");
    } else if ([403, 404, 410].includes(head.status)) url = undefined;
    else throw Error("Upload checkpoint unavailable. Retry to confirm safely.");
  }
  if (!url) {
    const metadata = Object.entries({
      bucketName: "project-documents",
      objectName: String(data.storage_path),
      contentType: String(data.content_type),
      cacheControl: "3600",
    })
      .map(([k, v]) => `${k} ${btoa(v)}`)
      .join(",");
    const created = await request(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        "Upload-Length": String(file.size),
        "Upload-Metadata": metadata,
      },
    });
    if (!created.ok)
      throw Error(
        "Upload connection was not confirmed. Retry to check storage.",
      );
    const location = created.headers.get("Location");
    if (!location) throw Error("Upload connection unavailable.");
    url = checked(location);
    remember(url.href);
  }
  progress(Math.round((offset / file.size) * 100));
  while (offset < file.size) {
    const end = Math.min(file.size, offset + 6 * 1024 * 1024);
    const patch = await request(url, {
      method: "PATCH",
      headers: {
        ...headers,
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: file.slice(offset, end),
    });
    if (!patch.ok || Number(patch.headers.get("Upload-Offset")) !== end)
      throw Error(
        "Upload interrupted. Retry the same file to continue safely.",
      );
    offset = end;
    progress(Math.round((offset / file.size) * 100));
  }
}
