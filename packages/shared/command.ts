import { CommandError } from "./error";
import type { RESPLiteValue } from "./resplite";

export enum CommandType {
  // Shared
  Down = "DOWN",
  Up = "UP",
  // Server to client
  Info = "INFO",
}

export interface DownCommand {
  type: CommandType.Down;
  offset: number;
}

export interface UpCommand {
  type: CommandType.Up;
  offset: number;
}

export interface InfoCommand {
  type: CommandType.Info;
  connectedUsers: number;
}

export type Command = DownCommand | UpCommand | InfoCommand;

class CommandParser {
  private array: Array<RESPLiteValue> = [];
  private pos = 0;

  constructor(resp: RESPLiteValue) {
    if (resp.type !== "array") {
      throw new CommandError("Expected array");
    }

    if (resp.value.length === 0) {
      throw new CommandError("Empty array");
    }

    this.array = resp.value;
    this.pos = 0;
  }

  public parse(): Command {
    const command = this.takeSimpleString().toUpperCase();
    switch (command) {
      case CommandType.Down:
        return this.parseDown();
      case CommandType.Up:
        return this.parseUp();
      case CommandType.Info:
        return this.parseInfo();
      default:
        throw new CommandError("Unknown command");
    }
  }

  private parseDown(): DownCommand {
    const offset = this.takeInteger();
    return { type: CommandType.Down, offset };
  }

  private parseUp(): UpCommand {
    const offset = this.takeInteger();
    return { type: CommandType.Up, offset };
  }

  private parseInfo(): InfoCommand {
    const connectedUsers = this.takeInteger();
    return { type: CommandType.Info, connectedUsers };
  }

  private takeSimpleString() {
    const current = this.current();
    if (current.type !== "simple-string") {
      throw new CommandError("Expected simple string");
    }

    this.advance(1);

    return current.value;
  }

  private takeInteger() {
    const current = this.current();
    if (current.type !== "integer") {
      throw new CommandError("Expected integer");
    }

    this.advance(1);

    return current.value;
  }

  private advance(n: number) {
    this.pos += n;
  }

  private current() {
    if (this.pos >= this.array.length) {
      throw new CommandError("Unexpected end of array");
    }

    return this.array[this.pos];
  }
}

export function parseCommand(resp: RESPLiteValue): Command {
  const parser = new CommandParser(resp);
  return parser.parse();
}
