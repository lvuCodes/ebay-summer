import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeInline } from "../src/lib/inline.js";

test("plain text is a single text token", () => {
  assert.deepEqual(tokenizeInline("hello world"), [
    { type: "text", value: "hello world" },
  ]);
});

test("backticks become code tokens", () => {
  assert.deepEqual(tokenizeInline("use `eval()` here"), [
    { type: "text", value: "use " },
    { type: "code", value: "eval()" },
    { type: "text", value: " here" },
  ]);
});

test("asterisks become em tokens", () => {
  assert.deepEqual(tokenizeInline("a *unit* figure"), [
    { type: "text", value: "a " },
    { type: "em", value: "unit" },
    { type: "text", value: " figure" },
  ]);
});

test("mixed code and em in one string", () => {
  const toks = tokenizeInline("`.bo-main-container` then *emph*");
  assert.deepEqual(toks.map((t) => t.type), ["code", "text", "em"]);
});

test("null / empty input yields no tokens", () => {
  assert.deepEqual(tokenizeInline(null), []);
  assert.deepEqual(tokenizeInline(""), []);
});
