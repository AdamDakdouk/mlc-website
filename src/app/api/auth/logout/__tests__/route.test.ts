import { NextRequest } from "next/server";

describe("POST /api/auth/logout", () => {
  it("clears the token cookie", async () => {
    const { POST } = require("@/app/api/auth/logout/route");
    const res = await POST(new NextRequest("http://localhost/api/auth/logout", { method: "POST" }));

    expect(res.status).toBe(200);
    const cookie = res.cookies.get("token");
    expect(cookie?.value).toBe("");
  });
});
