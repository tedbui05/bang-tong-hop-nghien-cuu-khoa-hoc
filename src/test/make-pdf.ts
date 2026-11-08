// Tự dựng file PDF nhỏ cho bài test, để không phải lưu file nhị phân vào git
// và đọc code là biết file mẫu chứa gì. Chỉ dùng trong test.
import { createHash } from "node:crypto";

type PageSpec = { lines: string[] } | { image: true };

type Encryption = { userPassword: string; ownerPassword: string };

const latin1 = (text: string) => Buffer.from(text, "latin1");

function escapePdfString(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// ---- Mã hoá chuẩn của PDF, bản 40-bit RC4 (Revision 2), theo đặc tả PDF 1.7 mục 7.6.3 ----

const PASSWORD_PADDING = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);

function rc4(key: Buffer, data: Buffer) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
const padPassword = (password: string) => Buffer.concat([latin1(password), PASSWORD_PADDING]).subarray(0, 32);

function makeEncryption({ userPassword, ownerPassword }: Encryption, fileId: Buffer) {
  const permissions = -44; // cho in và chép, không cho sửa
  const ownerKey = md5(padPassword(ownerPassword || userPassword)).subarray(0, 5);
  const o = rc4(ownerKey, padPassword(userPassword));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);
  const key = md5(padPassword(userPassword), o, p, fileId).subarray(0, 5);
  const u = rc4(key, PASSWORD_PADDING);
  const dict = `<< /Filter /Standard /V 1 /R 2 /Length 40 /P ${permissions} /O <${o.toString("hex")}> /U <${u.toString("hex")}> >>`;
  const encryptObject = (objectNumber: number, data: Buffer) => {
    const suffix = Buffer.from([objectNumber & 255, (objectNumber >> 8) & 255, (objectNumber >> 16) & 255, 0, 0]);
    return rc4(md5(key, suffix).subarray(0, 10), data);
  };
  return { dict, encryptObject };
}

// ---- Dựng file ----

export function makePdf(pages: PageSpec[], options: { encrypt?: Encryption } = {}) {
  const fileId = md5(latin1(JSON.stringify(pages)));
  const encryption = options.encrypt ? makeEncryption(options.encrypt, fileId) : null;
  const objects: Buffer[] = [];
  const add = (body: Buffer | string) => {
    objects.push(typeof body === "string" ? latin1(body) : body);
    return objects.length;
  };
  const stream = (dict: string, data: Buffer) => {
    const number = objects.length + 1;
    const body = encryption ? encryption.encryptObject(number, data) : data;
    return add(Buffer.concat([latin1(`<< ${dict} /Length ${body.length} >>\nstream\n`), body, latin1("\nendstream")]));
  };

  const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // chỗ cho cây trang, điền sau khi biết các trang
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  // Ảnh xám 8x8 thay cho trang scan.
  const image = stream(
    "/Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8",
    Buffer.alloc(64, 128),
  );

  const pageNumbers = pages.map((spec) => {
    const content =
      "image" in spec
        ? "q 500 0 0 700 50 50 cm /Im0 Do Q"
        : `BT /F1 12 Tf 14 TL 72 740 Td ${spec.lines.map((line) => `(${escapePdfString(line)}) Tj T*`).join(" ")} ET`;
    const contents = stream("", latin1(content));
    return add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contents} 0 R ` +
        `/Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im0 ${image} 0 R >> >> >>`,
    );
  });
  objects[1] = latin1(`<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  const encryptRef = encryption ? add(encryption.dict) : null;

  const parts: Buffer[] = [latin1("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
  const offsets: number[] = [];
  let length = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([latin1(`${i + 1} 0 obj\n`), body, latin1("\nendobj\n")]);
    parts.push(chunk);
    length += chunk.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /ID [<${fileId.toString("hex")}> <${fileId.toString("hex")}>]` +
    (encryptRef ? ` /Encrypt ${encryptRef} 0 R` : "") +
    ` >>\nstartxref\n${length}\n%%EOF\n`;
  parts.push(latin1(xref));
  return new Uint8Array(Buffer.concat(parts));
}

export function pdfFile(bytes: Uint8Array | string, name = "bai-bao.pdf") {
  return new File([typeof bytes === "string" ? latin1(bytes) : Buffer.from(bytes)], name, { type: "application/pdf" });
}
