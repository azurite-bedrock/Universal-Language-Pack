import { assertEquals } from "jsr:@std/assert";
import {
  computeUnhandled,
  normalizeLangCode,
  parseLangFile,
  sortVersionsOldestFirst,
} from "./check.ts";

Deno.test("parseLangFile skips comment lines", () => {
  const result = parseLangFile("# comment\naccessibility.foo=Bar");
  assertEquals(result.get("accessibility.foo"), "Bar");
  assertEquals(result.size, 1);
});

Deno.test("parseLangFile skips blank lines", () => {
  const result = parseLangFile("\naccessibility.foo=Bar\n\n");
  assertEquals(result.size, 1);
});

Deno.test("parseLangFile preserves = characters in values", () => {
  const result = parseLangFile("key=value=with=equals");
  assertEquals(result.get("key"), "value=with=equals");
});

Deno.test("sortVersionsOldestFirst orders by numeric components", () => {
  const result = sortVersionsOldestFirst(["1.20.0.1", "1.10.0.7", "1.9.0.15"]);
  assertEquals(result, ["1.9.0.15", "1.10.0.7", "1.20.0.1"]);
});

Deno.test("sortVersionsOldestFirst handles large patch numbers", () => {
  const result = sortVersionsOldestFirst(["1.20.30.26", "1.20.0.1"]);
  assertEquals(result, ["1.20.0.1", "1.20.30.26"]);
});

Deno.test("normalizeLangCode replaces underscore with hyphen", () => {
  assertEquals(normalizeLangCode("de_DE"), "de-DE");
  assertEquals(normalizeLangCode("zh_CN"), "zh-CN");
  assertEquals(normalizeLangCode("en_US"), "en-US");
});

Deno.test("computeUnhandled returns versions not in handled set", () => {
  const result = computeUnhandled(
    ["1.10.0.7", "1.11.0.23", "1.13.0.34"],
    ["1.10.0.7"],
  );
  assertEquals(result, ["1.11.0.23", "1.13.0.34"]);
});

Deno.test("computeUnhandled returns all when handled is empty", () => {
  const result = computeUnhandled(["1.10.0.7", "1.11.0.23"], []);
  assertEquals(result, ["1.10.0.7", "1.11.0.23"]);
});

Deno.test("computeUnhandled returns empty when all are handled", () => {
  const result = computeUnhandled(["1.10.0.7"], ["1.10.0.7"]);
  assertEquals(result, []);
});
