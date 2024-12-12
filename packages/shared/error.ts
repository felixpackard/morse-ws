export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

export class EncodeError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncodeError.prototype);
  }
}

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, CommandError.prototype);
  }
}
