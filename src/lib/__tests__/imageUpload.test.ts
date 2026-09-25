import { unlink, access } from "fs/promises";
import path from "path";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const WEBP_BYTES = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("imageUpload", () => {
  const savedPaths: string[] = [];

  afterEach(async () => {
    for (const url of savedPaths.splice(0)) {
      const filePath = path.join(process.cwd(), "public", url);
      await unlink(filePath).catch(() => {});
    }
  });

  it("saves a valid JPEG under the given folder and returns its public URL", async () => {
    const file = makeFile(JPEG_BYTES, "photo.jpg", "image/jpeg");
    const url = await validateAndSaveImage(file, "announcements");
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.jpg$/);
  });

  it("saves a file under a different folder correctly", async () => {
    const file = makeFile(PNG_BYTES, "photo.png", "image/png");
    const url = await validateAndSaveImage(file, "teachers");
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/teachers\/[a-f0-9-]+\.png$/);
  });

  it("saves a valid WebP and returns its public URL", async () => {
    const file = makeFile(WEBP_BYTES, "photo.webp", "image/webp");
    const url = await validateAndSaveImage(file, "announcements");
    savedPaths.push(url);
    expect(url).toMatch(/^\/uploads\/announcements\/[a-f0-9-]+\.webp$/);
  });

  it("rejects a file whose content isn't a recognized image format, regardless of claimed type", async () => {
    const file = makeFile([0x00, 0x01, 0x02, 0x03], "fake.jpg", "image/jpeg");
    await expect(validateAndSaveImage(file, "announcements")).rejects.toThrow(ImageValidationError);
  });

  it("rejects a file over 5MB", async () => {
    const bigBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    bigBytes.set(JPEG_BYTES);
    const file = new File([bigBytes], "big.jpg", { type: "image/jpeg" });
    await expect(validateAndSaveImage(file, "announcements")).rejects.toThrow(ImageValidationError);
  });

  it("deleteImageFile removes an existing file without error", async () => {
    const file = makeFile(JPEG_BYTES, "to-delete.jpg", "image/jpeg");
    const url = await validateAndSaveImage(file, "announcements");
    const filePath = path.join(process.cwd(), "public", url);

    await deleteImageFile(url);

    await expect(access(filePath)).rejects.toThrow();
  });

  it("deleteImageFile correctly deletes a file from a non-default folder", async () => {
    const file = makeFile(PNG_BYTES, "to-delete.png", "image/png");
    const url = await validateAndSaveImage(file, "teachers");
    const filePath = path.join(process.cwd(), "public", url);

    await deleteImageFile(url);

    await expect(access(filePath)).rejects.toThrow();
  });

  it("deleteImageFile does not throw when the file is already gone", async () => {
    await expect(
      deleteImageFile("/uploads/announcements/does-not-exist.jpg"),
    ).resolves.not.toThrow();
  });

  it("deleteImageFile no-ops on a malformed filename", async () => {
    await expect(deleteImageFile("/uploads/announcements/not-a-uuid.jpg")).resolves.not.toThrow();
    await expect(deleteImageFile("/uploads/announcements/..")).resolves.not.toThrow();
  });

  it("deleteImageFile no-ops when the folder segment isn't a plain safe name", async () => {
    await expect(
      deleteImageFile("/../00000000-0000-0000-0000-000000000000.jpg"),
    ).resolves.not.toThrow();
  });
});
