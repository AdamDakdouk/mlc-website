import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

describe("GET /uploads/[folder]/[filename]", () => {
  let tempRoot: string;
  const originalRoot = process.env.UPLOAD_ROOT;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "mlc-uploads-test-"));
    process.env.UPLOAD_ROOT = tempRoot;
  });

  afterEach(async () => {
    if (originalRoot === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = originalRoot;
    await rm(tempRoot, { recursive: true, force: true });
  });

  async function saveImage(folder: "teachers" | "announcements" | "achievements" = "teachers") {
    const { validateAndSaveImage } = require("@/lib/imageUpload");
    const url: string = await validateAndSaveImage(
      new File([new Uint8Array(JPEG_BYTES)], "photo.jpg", { type: "image/jpeg" }),
      folder,
    );
    return { url, filename: path.basename(url) };
  }

  function get(folder: string, filename: string) {
    const { GET } = require("@/app/uploads/[folder]/[filename]/route");
    return GET(new Request(`http://localhost/uploads/${folder}/${filename}`), {
      params: Promise.resolve({ folder, filename }),
    });
  }

  it("serves an image saved after startup, with type and long-lived cache headers", async () => {
    const { filename } = await saveImage("teachers");

    const res = await get("teachers", filename);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(JPEG_BYTES);
  });

  it("reads from UPLOAD_ROOT, not the project's public folder", async () => {
    const { filename } = await saveImage("announcements");
    const { access } = require("fs/promises");

    await expect(
      access(path.join(tempRoot, "public", "uploads", "announcements", filename)),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(process.cwd(), "public", "uploads", "announcements", filename)),
    ).rejects.toThrow();
  });

  it("returns 404 for a file that does not exist", async () => {
    const res = await get("teachers", "11111111-1111-1111-1111-111111111111.jpg");
    expect(res.status).toBe(404);
  });

  it("returns 404 for a folder outside the allowlist", async () => {
    const { filename } = await saveImage("teachers");
    expect((await get("resumes", filename)).status).toBe(404);
    expect((await get("..", filename)).status).toBe(404);
  });

  it("does not serve private uploads by name", async () => {
    const { mkdir, writeFile } = require("fs/promises");
    const privateDir = path.join(tempRoot, "uploads-private", "payment-proofs");
    await mkdir(privateDir, { recursive: true });
    await writeFile(
      path.join(privateDir, "22222222-2222-2222-2222-222222222222.jpg"),
      Buffer.from(JPEG_BYTES),
    );

    expect((await get("payment-proofs", "22222222-2222-2222-2222-222222222222.jpg")).status).toBe(404);
  });

  it.each([
    "../../etc/passwd",
    "..\..\secret.jpg",
    "photo.jpg",
    "11111111-1111-1111-1111-111111111111.gif",
    "11111111-1111-1111-1111-111111111111.jpg/extra",
    "",
  ])("returns 404 for a malformed filename: %p", async (filename) => {
    expect((await get("teachers", filename)).status).toBe(404);
  });
});
