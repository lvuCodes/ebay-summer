// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, test } from "vitest";
import Changelog from "../src/pages/Changelog.tsx";
import Landing from "../src/pages/Landing.tsx";
import { REPO_LINK_LABEL } from "../src/components/RepoLink.tsx";

afterEach(cleanup);

for (const [name, Page] of [
  ["Landing", Landing],
  ["Changelog", Changelog],
] as const) {
  test(`${name} footer links the repository in a new tab, named for the repo`, () => {
    const { container } = render(createElement(Page));
    const link = [...container.querySelectorAll("footer a")].find(
      (a) => a.textContent === REPO_LINK_LABEL,
    );
    expect(link?.getAttribute("href")).toBe("https://github.com/lvuCodes/ebay-summer");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noreferrer noopener");
  });
}
