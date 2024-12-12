import { expect, test } from "bun:test";
import { CommandType, parseCommand } from "./command";
import { RESPType } from "./resplite";

test("parse down command", () => {
  const result = parseCommand({
    type: RESPType.Array,
    value: [
      { type: RESPType.SimpleString, value: "down" },
      { type: RESPType.Integer, value: 5 },
    ],
  });
  expect(result).toEqual({ type: CommandType.Down, offset: 5 });
});

test("parse up command", () => {
  const result = parseCommand({
    type: RESPType.Array,
    value: [
      { type: RESPType.SimpleString, value: "up" },
      { type: RESPType.Integer, value: 5 },
    ],
  });
  expect(result).toEqual({ type: CommandType.Up, offset: 5 });
});
