import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import {
  documentFileIdentity,
  validateDocumentBytes,
} from "../lib/document-file";
assert.equal(
  documentFileIdentity("unsafe/Job plan.PDF", 100).filename,
  "Job plan.pdf",
);
for (const [name, size] of [
  ["x.exe", 1],
  ["x.pdf", 0],
  ["x.pdf", 20971521],
  ["macro.docm", 100],
  ["old.doc", 100],
])
  assert.throws(() => documentFileIdentity(name, size));
for (const filename of [
  "normal-multi-page.pdf",
  "image-only.pdf",
  "encrypted.pdf",
])
  assert.equal(
    validateDocumentBytes(
      filename,
      readFileSync("tests/fixtures/pdf-text-extract/" + filename),
    ),
    "application/pdf",
  );
assert.throws(() =>
  validateDocumentBytes("fake.pdf", Buffer.from("not a pdf")),
);
assert.throws(() =>
  validateDocumentBytes("fake.png", Buffer.from("not a png")),
);
function zip(files: Record<string, string>) {
  let offset = 0;
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  for (const [name, text] of Object.entries(files)) {
    const n = Buffer.from(name),
      data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(n.length, 26);
    locals.push(local, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(Buffer.byteLength(text), 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}
const base = {
  "[Content_Types].xml":
    "<Types>application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml</Types>",
  "word/document.xml": "<document/>",
};
assert.match(
  validateDocumentBytes("source.docx", zip(base)),
  /wordprocessingml/,
);
for (const extra of [
  { "word/vbaProject.bin": "macro" },
  { "word/embeddings/file.bin": "embedded" },
  { "../file": "traversal" },
  { "[Content_Types].xml": "<!DOCTYPE bad>wordprocessingml" },
  { "xl/externalLinks/link.xml": "external" },
])
  assert.throws(() =>
    validateDocumentBytes("source.docx", zip({ ...base, ...extra })),
  );
assert.throws(() => validateDocumentBytes("source.xlsx", zip(base)));
console.log(
  "PASS document type/size/envelope validation, bounded Office ZIP, traversal/macros/embedding/external-link rejection",
);
