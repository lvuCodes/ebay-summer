import { test } from "node:test";
import assert from "node:assert/strict";
import { BACK_LINK_HREF, BACK_LINK_LABEL } from "../src/lib/site.js";

test("back link href is the author's https home page", () => {
  const url = new URL(BACK_LINK_HREF);
  assert.equal(url.protocol, "https:");
  assert.equal(url.host, "lvucodes.github.io");
});

test("back link label keeps a back-arrow affordance", () => {
  assert.ok(BACK_LINK_LABEL.startsWith("← "));
  assert.ok(BACK_LINK_LABEL.trim().length > 2);
});
