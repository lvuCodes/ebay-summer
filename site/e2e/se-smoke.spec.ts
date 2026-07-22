import { expect, test } from "@playwright/test";
import { defineSeSmoke } from "@lvucodes/ui/se-smoke";

// The shared iPhone SE base suite: no horizontal overflow, back link anchored at
// 20/20, and the primary controls (a.pill + demo buttons) unclipped.
defineSeSmoke();

// Site-specific assertions layered on top of the shared base.
test.describe("eBay Σummer landing", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("brand stripe renders its four eBay color bands", async ({ page }) => {
    await page.goto("/");
    const stripe = page.locator(".brand-stripe");
    await expect(stripe).toBeVisible();
    await expect(stripe.locator("> span")).toHaveCount(4);
  });

  test("the back link keeps the site's own 999px pill skin", async ({ page }) => {
    await page.goto("/");
    // Proves the site's unlayered .pill wins over @lvucodes/ui's 6px primitive.
    const radius = await page
      .locator(".back-nav .pill")
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(radius).toBe("999px");
  });
});
