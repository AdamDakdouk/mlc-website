import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("redirects to /admin/login when no token cookie is present", async () => {
    const request = new NextRequest("http://localhost/admin/dashboard");
    const res = await proxy(request);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("redirects to /admin/login when the token is invalid", async () => {
    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: { cookie: "token=garbage-value" },
    });
    const res = await proxy(request);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("allows the request through when the token is valid", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: { cookie: `token=${token}` },
    });
    const res = await proxy(request);

    expect(res.status).toBe(200);
  });

  it("returns a 401 JSON response (not a redirect) for an unauthenticated API request", async () => {
    const request = new NextRequest("http://localhost/api/admin/announcements");
    const res = await proxy(request);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("allows an authenticated API request through", async () => {
    const token = await signToken({ sub: "admin@example.com", role: "admin" });
    const request = new NextRequest("http://localhost/api/admin/announcements", {
      headers: { cookie: `token=${token}` },
    });
    const res = await proxy(request);

    expect(res.status).toBe(200);
  });
});
