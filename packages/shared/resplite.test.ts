import { expect, test } from "bun:test";
import { parseRESP, RESPType } from "./resplite";

test("parse simple string", () => {
  const result = parseRESP("+hello\r\n");
  expect(result).toEqual({ type: RESPType.SimpleString, value: "hello" });
});

test("parse array of simple strings", () => {
  const result = parseRESP("*2\r\n+hello\r\n+world\r\n");
  expect(result).toEqual({
    type: RESPType.Array,
    value: [
      { type: RESPType.SimpleString, value: "hello" },
      { type: RESPType.SimpleString, value: "world" },
    ],
  });
});

test("parse integer", () => {
  const result = parseRESP(":123\r\n");
  expect(result).toEqual({ type: RESPType.Integer, value: 123 });
});
