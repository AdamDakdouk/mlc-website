import { readFile as fsReadFile } from "fs/promises";
import path from "path";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const NOT_IMAGE_BYTES = Buffer.from("just some text, not an image");

const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private");

describe("paymentProofUpload", () => {
  const createdFilenames: string[] = [];

  afterEach(async () => {
    const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
    for (const filename of createdFilenames.splice(0)) {
      await deletePaymentProofFile(filename);
    }
  });

  describe("validateAndSavePaymentProof", () => {
    it("saves a valid JPEG and returns a UUID-based filename", async () => {
      const { validateAndSavePaymentProof } = require("@/lib/paymentProofUpload");
      const file = new File([JPEG_BYTES], "proof.jpg", { type: "image/jpeg" });

      const filename = await validateAndSavePaymentProof(file);
      createdFilenames.push(filename);

      expect(filename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
      const saved = await fsReadFile(path.join(PRIVATE_ROOT, "payment-proofs", filename));
      expect(saved.equals(JPEG_BYTES)).toBe(true);
    });

    it("rejects a file that isn't actually an image, regardless of claimed type", async () => {
      const { validateAndSavePaymentProof, PaymentProofValidationError } = require("@/lib/paymentProofUpload");
      const file = new File([NOT_IMAGE_BYTES], "proof.jpg", { type: "image/jpeg" });

      await expect(validateAndSavePaymentProof(file)).rejects.toThrow(PaymentProofValidationError);
    });

    it("rejects a file over 5MB", async () => {
      const { validateAndSavePaymentProof, PaymentProofValidationError } = require("@/lib/paymentProofUpload");
      const bigBytes = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
      const file = new File([bigBytes], "proof.jpg", { type: "image/jpeg" });

      await expect(validateAndSavePaymentProof(file)).rejects.toThrow(PaymentProofValidationError);
    });
  });

  describe("readPaymentProofFile", () => {
    it("reads back a saved proof", async () => {
      const { validateAndSavePaymentProof, readPaymentProofFile } = require("@/lib/paymentProofUpload");
      const file = new File([JPEG_BYTES], "proof.jpg", { type: "image/jpeg" });
      const filename = await validateAndSavePaymentProof(file);
      createdFilenames.push(filename);

      const buffer = await readPaymentProofFile(filename);
      expect(buffer.equals(JPEG_BYTES)).toBe(true);
    });

    it("rejects a filename that doesn't match the expected UUID.ext shape", async () => {
      const { readPaymentProofFile, PaymentProofValidationError } = require("@/lib/paymentProofUpload");

      await expect(readPaymentProofFile("../../etc/passwd")).rejects.toThrow(PaymentProofValidationError);
      await expect(readPaymentProofFile("not-a-uuid.jpg")).rejects.toThrow(PaymentProofValidationError);
    });
  });

  describe("deletePaymentProofFile", () => {
    it("deletes a saved proof", async () => {
      const { validateAndSavePaymentProof, deletePaymentProofFile, readPaymentProofFile } = require("@/lib/paymentProofUpload");
      const file = new File([JPEG_BYTES], "proof.jpg", { type: "image/jpeg" });
      const filename = await validateAndSavePaymentProof(file);
      createdFilenames.push(filename);

      await deletePaymentProofFile(filename);

      await expect(readPaymentProofFile(filename)).rejects.toThrow();
    });

    it("does not throw when deleting a non-existent file", async () => {
      const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
      await expect(
        deletePaymentProofFile("22222222-2222-2222-2222-222222222222.jpg"),
      ).resolves.not.toThrow();
    });

    it("silently no-ops for a malformed filename rather than deleting arbitrary paths", async () => {
      const { deletePaymentProofFile } = require("@/lib/paymentProofUpload");
      await expect(deletePaymentProofFile("../../etc/passwd")).resolves.not.toThrow();
    });
  });
});
