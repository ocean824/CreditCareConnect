import { describe, it } from "vitest";
import request from "supertest";
import { app } from "../../server/index";

describe("Observability", () => {
  it("healthz is OK", async () => {
    await request(app).get("/healthz").expect(200);
  });
});
