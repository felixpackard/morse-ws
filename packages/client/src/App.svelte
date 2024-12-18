<script lang="ts">
  import {
    CommandType,
    parseCommand,
    type DownCommand,
    type UpCommand,
  } from "shared/command";
  import { encodeRESP, parseRESP, RESPType } from "shared/resplite";
  import { onDestroy, onMount } from "svelte";
  import { AudioWaveform } from "lucide-svelte";

  const BUFFER_DELAY = 1000;
  const BASE_RETRY_TIME = 1000;

  type SocketState =
    | "Connected"
    | "Disconnected"
    | "Connecting..."
    | "Reconnecting...";

  let initialised = $state(false);
  let muted = $state(false);
  let socketState: SocketState = $state("Connecting...");
  let connectedUsers = $state(0);
  let keyPressed = $state(false);

  let txStartedAt = -1;

  let rxBuffer: Array<DownCommand | UpCommand> = [];
  let rxOffset = 0;

  let transmitting = $state(false);
  let receiving = $state(false);

  let transmissionTimeout: Timer | null = null;

  let audioContext: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;

  let socket: WebSocket;
  let retryTime = BASE_RETRY_TIME;

  onMount(() => {
    socket = setupSocket();
  });

  onDestroy(() => {
    socket.close();
    audioContext?.close();
    oscillator?.disconnect();
    gainNode?.disconnect();
  });

  function setupSound() {
    audioContext = new AudioContext();
    oscillator = audioContext.createOscillator();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);

    gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
  }

  function initialise() {
    setupSound();
    initialised = true;
  }

  function startSound() {
    if (muted) {
      return;
    }

    if (!audioContext || !gainNode) {
      return;
    }

    oscillator?.disconnect();
    gainNode.disconnect();

    oscillator = audioContext.createOscillator();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);

    gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
  }

  function stopSound() {
    if (!gainNode || !audioContext) {
      return;
    }

    const stopTime = audioContext.currentTime + 0.1;

    oscillator?.stop(stopTime);

    gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime - 0.05);
  }

  function setupSocket() {
    const socket = new WebSocket(
      import.meta.env.DEV
        ? `ws://${window.location.hostname}:3000/ws`
        : "wss://morse.felixpackard.dev/ws",
    );

    socket.onopen = function () {
      socketState = "Connected";
      retryTime = BASE_RETRY_TIME;
    };

    socket.onclose = function (event) {
      if (!event.wasClean) {
        socketState = "Reconnecting...";
        handleUnexpectedDisconnect();
      } else {
        socketState = "Disconnected";
      }
    };

    socket.onerror = function () {
      socketState = "Reconnecting...";
    };

    socket.onmessage = function (event) {
      const resp = parseRESP(event.data);
      const command = parseCommand(resp);

      switch (command.type) {
        case CommandType.Down:
        case CommandType.Up:
          rxBuffer.push(command);
          if (!receiving) {
            receiving = true;
            setTimeout(processRxBuffer, BUFFER_DELAY);
          }
          break;
        case CommandType.Info:
          connectedUsers = command.connectedUsers;
          break;
        default:
          console.error("Unknown command type", command);
      }
    };

    return socket;
  }

  function handleUnexpectedDisconnect() {
    socketState = "Disconnected";

    setTimeout(() => {
      socketState = "Reconnecting...";
      socket = setupSocket();
    }, retryTime);

    retryTime *= 2;
  }

  function processRxBuffer() {
    const command = rxBuffer.shift();
    if (!command) {
      receiving = false;
      return;
    }

    switch (command.type) {
      case CommandType.Down:
        rxOffset = command.offset;
        startSound();
        break;
      case CommandType.Up:
        rxOffset = command.offset;
        stopSound();
        break;
      default:
        console.error("Unknown command type", command);
    }

    const nextCommand = rxBuffer[0];
    if (nextCommand) {
      setTimeout(processRxBuffer, nextCommand.offset - rxOffset);
    } else {
      receiving = false;
      rxOffset = 0;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!initialised) return;
    if (event.key === ".") {
      keyDown();
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (!initialised) return;
    if (event.key === ".") {
      keyUp();
    }
  }

  function keyDown() {
    if (socketState !== "Connected") {
      return;
    }

    keyPressed = true;

    startSound();

    const now = Date.now();
    const offset = txStartedAt === -1 ? 0 : now - txStartedAt;
    if (txStartedAt === -1) {
      transmitting = true;
      txStartedAt = now;
    }

    // TODO: Add method to encode command as RESP
    const resp = encodeRESP({
      type: RESPType.Array,
      value: [
        { type: RESPType.SimpleString, value: "down" },
        { type: RESPType.Integer, value: offset },
      ],
    });

    socket.send(resp);

    scheduleTransmissionEnd();
  }

  function keyUp() {
    keyPressed = false;

    stopSound();

    if (!txStartedAt) {
      return;
    }

    const offset = Date.now() - txStartedAt;

    // TODO: Add method to encode command as RESP
    const resp = encodeRESP({
      type: RESPType.Array,
      value: [
        { type: RESPType.SimpleString, value: "up" },
        { type: RESPType.Integer, value: offset },
      ],
    });

    socket.send(resp);

    scheduleTransmissionEnd();
  }

  function scheduleTransmissionEnd() {
    if (transmissionTimeout) {
      clearTimeout(transmissionTimeout);
    }

    transmissionTimeout = setTimeout(() => {
      transmitting = false;
      txStartedAt = -1;
    }, BUFFER_DELAY);
  }
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<main>
  {#if initialised}
    <div class="flex h-svh items-center justify-center bg-slate-900">
      <div
        class="xs:w-[400px] xs:rounded-md flex w-full flex-col bg-slate-700 font-mono text-slate-100 shadow-md">
        <div class="flex items-center justify-between p-4">
          <span>{socketState}</span>
          <span class="flex items-center gap-2">
            <span class="size-3 rounded-full bg-green-500"></span>
            {#if socketState === "Connected"}
              <span class="text-sm text-slate-200"
                >{connectedUsers} online</span>
            {/if}
          </span>
        </div>
        <div class="p-4 pt-0">
          <button
            onpointerdown={(e) => {
              e.preventDefault();
              keyDown();
            }}
            onpointerup={keyUp}
            class="flex h-32 w-full items-center justify-center rounded-md border-2 border-dashed border-slate-500 p-4 text-sm text-slate-300"
            class:!border-slate-300={keyPressed}>
            <span>Click or press "." to transmit</span>
          </button>
        </div>
        <div class="flex items-center justify-between p-4 pt-0">
          <span class="text-sm text-slate-200">v1.0.0</span>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span
                class="size-3 rounded-full"
                class:bg-green-500={transmitting}
                class:bg-slate-500={!transmitting}></span>
              <span class="text-sm text-slate-200">TX</span>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="size-3 rounded-full"
                class:bg-green-500={receiving}
                class:bg-slate-500={!receiving}></span>
              <span class="text-sm text-slate-200">RX</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      class="fixed bottom-0 left-0 right-0 flex justify-center py-4 font-mono text-sm text-slate-500">
      Made with ♥ by&nbsp;<a
        href="https://github.com/felixpackard/morse-ws"
        target="_blank"
        rel="noopener noreferrer"
        class="underline">felixpackard</a>
    </div>
  {:else}
    <button
      onclick={initialise}
      class="flex h-svh w-screen items-center justify-center bg-slate-900 font-mono text-slate-100">
      <div class="text-balance px-4">
        <AudioWaveform class="inline size-5" />
        <span>Touch or click to enabled audio.</span>
      </div>
    </button>
  {/if}
</main>
