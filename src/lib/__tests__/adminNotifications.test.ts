jest.mock("@/lib/mailer", () => ({
  sendAdminNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));

import { notifyAdmin } from "@/lib/adminNotifications";
import { sendAdminNotificationEmail } from "@/lib/mailer";
import { SITE_EMAIL } from "@/lib/siteContact";

const sendMock = sendAdminNotificationEmail as jest.Mock;

const notification = {
  subject: "New thing",
  replyTo: "jane@example.com",
  details: [
    ["Name", "Jane"],
    ["Message", ""],
  ] as Array<[string, string]>,
  adminUrl: "http://localhost:3000/admin/dashboard/x",
};

describe("notifyAdmin", () => {
  const originalHost = process.env.SMTP_HOST;
  const originalNotify = process.env.ADMIN_NOTIFY_EMAIL;

  beforeEach(() => {
    sendMock.mockClear();
    sendMock.mockResolvedValue(undefined);
    process.env.SMTP_HOST = "smtp.test.local";
    delete process.env.ADMIN_NOTIFY_EMAIL;
  });

  afterEach(() => {
    if (originalHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalHost;
    if (originalNotify === undefined) delete process.env.ADMIN_NOTIFY_EMAIL;
    else process.env.ADMIN_NOTIFY_EMAIL = originalNotify;
  });

  it("does nothing when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    await notifyAdmin(notification);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends to the site email by default, with reply-to and a labelled body", async () => {
    await notifyAdmin(notification);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const args = sendMock.mock.calls[0][0];
    expect(args.to).toBe(SITE_EMAIL);
    expect(args.replyTo).toBe("jane@example.com");
    expect(args.subject).toBe("New thing");
    expect(args.text).toContain("Name: Jane");
    expect(args.text).toContain("Message: —");
    expect(args.text).toContain("http://localhost:3000/admin/dashboard/x");
  });

  it("sends to ADMIN_NOTIFY_EMAIL when set", async () => {
    process.env.ADMIN_NOTIFY_EMAIL = " admin@school.test ";
    await notifyAdmin(notification);
    expect(sendMock.mock.calls[0][0].to).toBe("admin@school.test");
  });

  it("strips line breaks from the subject", async () => {
    await notifyAdmin({ ...notification, subject: "Hi\r\nBcc: evil@example.com" });
    expect(sendMock.mock.calls[0][0].subject).toBe("Hi Bcc: evil@example.com");
  });

  it("logs and swallows a send failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    sendMock.mockRejectedValueOnce(new Error("SMTP down"));
    await expect(notifyAdmin(notification)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
