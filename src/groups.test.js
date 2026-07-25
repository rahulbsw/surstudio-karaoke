import assert from "node:assert/strict";
import test from "node:test";
import { makeInviteUrl } from "./groups.js";

test("builds a shareable invitation on the requested SurStudio origin", () => {
  assert.equal(
    makeInviteUrl("abc_DEF-123", "https://surstudio.datasierra.com"),
    "https://surstudio.datasierra.com/?invite=abc_DEF-123",
  );
});
