import { test, expect } from "vitest";
import { BACK_LINK_DEFAULT_HREF, BACK_LINK_DEFAULT_LABEL } from "@lvucodes/ui";

// The back link now comes from @lvucodes/ui; assert against the package's own
// exported defaults rather than restating the literal href/label here.
test("back link href is the author's https home page", () => {
  const url = new URL(BACK_LINK_DEFAULT_HREF);
  expect(url.protocol).toBe("https:");
  expect(url.host).toBe("lvucodes.github.io");
});

test("back link label keeps a back-arrow affordance", () => {
  expect(BACK_LINK_DEFAULT_LABEL.startsWith("← ")).toBe(true);
  expect(BACK_LINK_DEFAULT_LABEL.trim().length).toBeGreaterThan(2);
});
