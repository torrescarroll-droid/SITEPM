/** Validation only. Never executes Office/PDF active content; Office files are download-only. */
import { inflateRawSync } from "node:zlib";
export const DOCUMENT_FILE_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;
export function documentFileIdentity(raw: string, size: number) {
  const base = raw.split(/[/\\]/).pop()?.trim() ?? "";
  const ext = base.split(".").pop()?.toLowerCase() ?? "";
  if (
    !(ext in DOCUMENT_FILE_TYPES) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 20 * 1024 * 1024
  )
    throw Error("Choose PDF, JPG, PNG, DOCX, XLSX or PPTX, up to 20 MiB.");
  const filename =
    base
      .slice(0, base.lastIndexOf("."))
      .replace(/[^A-Za-z0-9._ -]/g, "_")
      .slice(0, 150) +
    "." +
    ext;
  return {
    filename,
    contentType: DOCUMENT_FILE_TYPES[ext as keyof typeof DOCUMENT_FILE_TYPES],
    ext,
  };
}
export function validateDocumentBytes(filename: string, bytes: Buffer) {
  const { ext, contentType } = documentFileIdentity(filename, bytes.length);
  const bad = () => {
    throw Error("The file contents do not match a supported format.");
  };
  if (ext === "pdf") {
    if (
      !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
      !bytes
        .subarray(Math.max(0, bytes.length - 2048))
        .includes(Buffer.from("%%EOF"))
    )
      bad();
  } else if (ext === "png") {
    if (
      bytes.length < 45 ||
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      !bytes.subarray(bytes.length - 12).includes(Buffer.from("IEND"))
    )
      bad();
    const w = bytes.readUInt32BE(16),
      h = bytes.readUInt32BE(20);
    if (!w || !h || w * h > 50000000) bad();
  } else if (ext === "jpg" || ext === "jpeg") {
    if (
      bytes.length < 12 ||
      bytes.readUInt16BE(0) !== 0xffd8 ||
      bytes.readUInt16BE(bytes.length - 2) !== 0xffd9
    )
      bad();
    let p = 2,
      dimensions = false,
      scan = false;
    while (p < bytes.length - 2) {
      if (bytes[p++] !== 0xff) return bad();
      while (bytes[p] === 0xff) p++;
      const marker = bytes[p++];
      if (marker === 0xda) {
        scan = true;
        break;
      }
      if (marker === 0xd9) break;
      if (p + 2 > bytes.length) return bad();
      const length = bytes.readUInt16BE(p);
      if (length < 2 || p + length > bytes.length) return bad();
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8) return bad();
        const h = bytes.readUInt16BE(p + 3),
          w = bytes.readUInt16BE(p + 5);
        if (!w || !h || w * h > 50000000) return bad();
        dimensions = true;
      }
      p += length;
    }
    if (!dimensions || !scan) bad();
  } else {
    // Inspect central directory before inflating only bounded content-type XML.
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
      if (bytes.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
      }
    if (end < 0) return bad();
    const count = bytes.readUInt16LE(end + 10),
      offset = bytes.readUInt32LE(end + 16);
    if (
      !count ||
      count > 2000 ||
      bytes.readUInt16LE(end + 4) ||
      bytes.readUInt16LE(end + 6)
    )
      bad();
    if (
      offset + bytes.readUInt32LE(end + 12) !== end ||
      bytes.readUInt16LE(end + 8) !== count
    )
      return bad();
    let cursor = offset,
      total = 0,
      types = "";
    const names = new Set<string>();
    for (let i = 0; i < count; i++) {
      if (
        cursor + 46 > bytes.length ||
        bytes.readUInt32LE(cursor) !== 0x02014b50
      )
        return bad();
      const flags = bytes.readUInt16LE(cursor + 8),
        method = bytes.readUInt16LE(cursor + 10),
        packed = bytes.readUInt32LE(cursor + 20),
        size = bytes.readUInt32LE(cursor + 24),
        len = bytes.readUInt16LE(cursor + 28),
        extra = bytes.readUInt16LE(cursor + 30),
        comment = bytes.readUInt16LE(cursor + 32),
        local = bytes.readUInt32LE(cursor + 42);
      if (
        cursor + 46 + len + extra + comment > end ||
        local + 30 > offset ||
        bytes.readUInt32LE(local) !== 0x04034b50
      )
        return bad();
      const start =
        local +
        30 +
        bytes.readUInt16LE(local + 26) +
        bytes.readUInt16LE(local + 28);
      if (
        start + packed > offset ||
        bytes.readUInt16LE(local + 8) !== method ||
        bytes.readUInt16LE(local + 6) & 1
      )
        return bad();
      const name = bytes.toString("utf8", cursor + 46, cursor + 46 + len);
      if (
        bytes.toString(
          "utf8",
          local + 30,
          local + 30 + bytes.readUInt16LE(local + 26),
        ) !== name
      )
        return bad();
      total += size;
      if (
        flags & 1 ||
        ![0, 8].includes(method) ||
        total > 100 * 1024 * 1024 ||
        size > 30 * 1024 * 1024 ||
        size > Math.max(1, packed) * 200 ||
        name.includes("..") ||
        name.startsWith("/") ||
        name.includes("\\") ||
        /vbaproject|activex|embeddings\/|externallinks\//i.test(name) ||
        names.has(name)
      )
        bad();
      names.add(name);
      if (name === "[Content_Types].xml") {
        if (
          size > 65536 ||
          local + 30 > bytes.length ||
          bytes.readUInt32LE(local) !== 0x04034b50
        )
          return bad();
        const data = bytes.subarray(start, start + packed);
        types = (
          method === 8 ? inflateRawSync(data, { maxOutputLength: 65536 }) : data
        ).toString("utf8");
      }
      cursor += 46 + len + extra + comment;
    }
    const root =
      ext === "docx"
        ? "word/document.xml"
        : ext === "xlsx"
          ? "xl/workbook.xml"
          : "ppt/presentation.xml";
    const kind =
      ext === "docx"
        ? "wordprocessingml"
        : ext === "xlsx"
          ? "spreadsheetml"
          : "presentationml";
    if (
      !names.has(root) ||
      !types.includes(kind) ||
      /macroEnabled|vbaProject|<!DOCTYPE|<!ENTITY/i.test(types)
    )
      bad();
  }
  return contentType;
}
