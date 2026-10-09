import path from "path";
import { privateUploadsRoot, publicUploadsRoot, storageRoot } from "@/lib/storagePaths";

describe("storagePaths", () => {
  const original = process.env.UPLOAD_ROOT;

  afterEach(() => {
    if (original === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = original;
  });

  it("defaults to the project directory", () => {
    delete process.env.UPLOAD_ROOT;
    expect(storageRoot()).toBe(process.cwd());
    expect(publicUploadsRoot()).toBe(path.join(process.cwd(), "public", "uploads"));
    expect(privateUploadsRoot("resumes")).toBe(
      path.join(process.cwd(), "uploads-private", "resumes"),
    );
  });

  it("moves every path under UPLOAD_ROOT when set", () => {
    process.env.UPLOAD_ROOT = path.join(path.sep, "var", "data");
    expect(publicUploadsRoot()).toBe(path.join(path.sep, "var", "data", "public", "uploads"));
    expect(privateUploadsRoot("payment-proofs")).toBe(
      path.join(path.sep, "var", "data", "uploads-private", "payment-proofs"),
    );
  });

  it("treats a blank UPLOAD_ROOT as unset", () => {
    process.env.UPLOAD_ROOT = "   ";
    expect(storageRoot()).toBe(process.cwd());
  });
});
