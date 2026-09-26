import { readFile as fsReadFile } from "fs/promises";
import path from "path";
import { deleteResumeFile } from "@/lib/resumeUpload";

const PDF_BYTES = Buffer.from("%PDF-1.4\n%test resume content\n");
const NOT_PDF_BYTES = Buffer.from("just some text, not a pdf");

const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private");

describe("resumeUpload", () => {
  const createdResumeFilenames: string[] = [];

  afterEach(async () => {
    for (const filename of createdResumeFilenames.splice(0)) {
      await deleteResumeFile(filename);
    }
  });

  describe("validateAndSaveResume", () => {
    it("saves a valid PDF and returns a UUID-based filename", async () => {
      const { validateAndSaveResume } = require("@/lib/resumeUpload");
      const file = new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" });

      const filename = await validateAndSaveResume(file);
      createdResumeFilenames.push(filename);

      expect(filename).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      const saved = await fsReadFile(path.join(PRIVATE_ROOT, "resumes", filename));
      expect(saved.equals(PDF_BYTES)).toBe(true);
    });

    it("rejects a file that isn't actually a PDF, regardless of claimed type", async () => {
      const { validateAndSaveResume, ResumeValidationError } = require("@/lib/resumeUpload");
      const file = new File([NOT_PDF_BYTES], "resume.pdf", { type: "application/pdf" });

      await expect(validateAndSaveResume(file)).rejects.toThrow(ResumeValidationError);
    });

    it("rejects a file over 5MB", async () => {
      const { validateAndSaveResume, ResumeValidationError } = require("@/lib/resumeUpload");
      const bigBytes = Buffer.concat([PDF_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
      const file = new File([bigBytes], "resume.pdf", { type: "application/pdf" });

      await expect(validateAndSaveResume(file)).rejects.toThrow(ResumeValidationError);
    });
  });

  describe("readResumeFile", () => {
    it("reads back a saved resume", async () => {
      const { validateAndSaveResume, readResumeFile } = require("@/lib/resumeUpload");
      const file = new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" });
      const filename = await validateAndSaveResume(file);
      createdResumeFilenames.push(filename);

      const buffer = await readResumeFile(filename);
      expect(buffer.equals(PDF_BYTES)).toBe(true);
    });

    it("rejects a filename that doesn't match the expected UUID.pdf shape", async () => {
      const { readResumeFile, ResumeValidationError } = require("@/lib/resumeUpload");

      await expect(readResumeFile("../../etc/passwd")).rejects.toThrow(ResumeValidationError);
      await expect(readResumeFile("not-a-uuid.pdf")).rejects.toThrow(ResumeValidationError);
    });
  });

  describe("deleteResumeFile", () => {
    it("deletes a saved resume", async () => {
      const { validateAndSaveResume, deleteResumeFile, readResumeFile } = require("@/lib/resumeUpload");
      const file = new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" });
      const filename = await validateAndSaveResume(file);
      createdResumeFilenames.push(filename);

      await deleteResumeFile(filename);

      await expect(readResumeFile(filename)).rejects.toThrow();
    });

    it("does not throw when deleting a non-existent file", async () => {
      const { deleteResumeFile } = require("@/lib/resumeUpload");
      await expect(
        deleteResumeFile("22222222-2222-2222-2222-222222222222.pdf"),
      ).resolves.not.toThrow();
    });

    it("silently no-ops for a malformed filename rather than deleting arbitrary paths", async () => {
      const { deleteResumeFile } = require("@/lib/resumeUpload");
      await expect(deleteResumeFile("../../etc/passwd")).resolves.not.toThrow();
    });
  });
});
