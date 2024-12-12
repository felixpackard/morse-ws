import { EncodeError, ParseError } from "./error";

export enum RESPType {
  SimpleString = "simple-string",
  Integer = "integer",
  Array = "array",
}

interface SimpleString {
  type: RESPType.SimpleString;
  value: string;
}

interface Integer {
  type: RESPType.Integer;
  value: number;
}

interface Array {
  type: RESPType.Array;
  value: RESPLiteValue[];
}

export type RESPLiteValue = SimpleString | Integer | Array;

export class RESPLiteParser {
  buf = "";
  pos = 0;

  constructor(buf: string) {
    this.buf = buf;
    this.pos = 0;
  }

  public parse(): RESPLiteValue {
    if (this.remaining().length === 0) {
      throw new ParseError("Empty buffer");
    }

    switch (this.current()) {
      case "+":
        return this.parseSimpleString();
      case ":":
        return this.parseInteger();
      case "*":
        return this.parseArray();
      default:
        throw new ParseError("Invalid RESPLite type");
    }
  }

  private parseSimpleString(): SimpleString {
    this.advance(1); // skip data type

    const content = this.readUntilCrlf();

    if (content.includes("\r") || content.includes("\n")) {
      throw new ParseError("Simple string cannot contain CR or LF");
    }

    return { type: RESPType.SimpleString, value: content };
  }

  private parseInteger(): Integer {
    this.advance(1); // skip data type

    const content = this.readUntilCrlf();

    if (!/^\d+$/.test(content)) {
      throw new ParseError("Invalid integer format");
    }

    return { type: RESPType.Integer, value: parseInt(content, 10) };
  }

  private parseArray(): Array {
    this.advance(1); // skip data type

    const content = this.readUntilCrlf();

    if (!/^\d+$/.test(content)) {
      throw new ParseError("Invalid array length format");
    }

    const length = parseInt(content, 10);
    const values: RESPLiteValue[] = [];

    for (let i = 0; i < length; i++) {
      values.push(this.parse());
    }

    return { type: RESPType.Array, value: values };
  }

  private current() {
    if (this.pos >= this.buf.length) {
      throw new ParseError("Unexpected end of input");
    }

    return this.buf[this.pos];
  }

  private remaining() {
    return this.buf.slice(this.pos);
  }

  private advance(n: number) {
    this.pos += n;
  }

  private readUntilCrlf() {
    const remaining = this.remaining();
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === "\r" && remaining[i + 1] === "\n") {
        this.advance(i + 2);
        return remaining.slice(0, i);
      }
    }

    throw new ParseError("CRLF not found");
  }
}

export function parseRESP(buf: string) {
  return new RESPLiteParser(buf).parse();
}

export function encodeRESP(resp: RESPLiteValue): string {
  switch (resp.type) {
    case RESPType.SimpleString:
      return `+${resp.value}\r\n`;
    case RESPType.Integer:
      return `:${resp.value}\r\n`;
    case RESPType.Array:
      return `*${resp.value.length}\r\n${resp.value.map(encodeRESP).join("")}`;
    default:
      throw new EncodeError("Invalid RESP type");
  }
}
