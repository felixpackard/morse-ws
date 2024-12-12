import serveStatic from "serve-static-bun";
import { CommandType, parseCommand } from "shared/command";
import { CommandError, ParseError } from "shared/error";
import {
  encodeRESP,
  parseRESP,
  RESPType,
  type RESPLiteValue,
} from "shared/resplite";

type WebSocketData = {};

let connected = 0;

const server = Bun.serve<WebSocketData>({
  fetch(req, server) {
    const path = new URL(req.url).pathname;
    if (path === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 400 });
      }
    }

    // handle HTTP request normally
    return serveStatic("public")(req);
  },
  websocket: {
    publishToSelf: false,
    async message(ws, message) {
      if (typeof message !== "string") {
        ws.send("Invalid message");
        return;
      }

      try {
        const resp = parseRESP(message);
        const command = parseCommand(resp);

        switch (command.type) {
          case CommandType.Down:
          case CommandType.Up:
            ws.publish("global", encodeRESP(resp));
            break;
          default:
            console.log("Unhandled command:", command);
        }
      } catch (e) {
        if (e instanceof ParseError || e instanceof CommandError) {
          ws.send(`Failed to parse command: ${e.message}`);
          return;
        }
      }
    },
    open(ws) {
      ws.subscribe("global");
      connected += 1;
      sendInfo();
    },
    close(ws, code, message) {
      ws.unsubscribe("global");
      connected -= 1;
      if (connected > 0) {
        sendInfo();
      }
    },
  },
});

function sendInfo() {
  const infoRESP: RESPLiteValue = {
    type: RESPType.Array,
    value: [
      { type: RESPType.SimpleString, value: "info" },
      {
        type: RESPType.Integer,
        value: connected,
      },
    ],
  };

  server.publish("global", encodeRESP(infoRESP));
}

console.log(`Listening on ${server.hostname}:${server.port}`);
