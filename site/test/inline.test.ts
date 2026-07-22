import { test, expect } from "vitest";
import { tokenizeInline } from "../src/lib/inline.ts";

test("plain text is a single text token", () => {
  expect(tokenizeInline("hello world")).toEqual([{ type: "text", value: "hello world" }]);
});

test("backticks become code tokens", () => {
  expect(tokenizeInline("use `eval()` here")).toEqual([
    { type: "text", value: "use " },
    { type: "code", value: "eval()" },
    { type: "text", value: " here" },
  ]);
});

test("asterisks become em tokens", () => {
  expect(tokenizeInline("a *unit* figure")).toEqual([
    { type: "text", value: "a " },
    { type: "em", value: "unit" },
    { type: "text", value: " figure" },
  ]);
});

test("mixed code and em in one string", () => {
  const toks = tokenizeInline("`.bo-main-container` then *emph*");
  expect(toks.map((t) => t.type)).toEqual(["code", "text", "em"]);
});

test("null / empty input yields no tokens", () => {
  expect(tokenizeInline(null)).toEqual([]);
  expect(tokenizeInline("")).toEqual([]);
});
