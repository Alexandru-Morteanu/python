import { createServer } from "http";
import { Server } from "socket.io";
import Elysia from "elysia";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import dotenv from "dotenv";

// Create an instance of Elysia and an HTTP server
const app = new Elysia();
// @ts-ignore
const httpServer = createServer(app);
dotenv.config();

// Create a Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let pythonProcess: ChildProcess | null = null;
const frameQueue: string[][] = [];
let processing = false;

function startPythonProcess(): void {
  const pythonScript = path.resolve("py.py");
  pythonProcess = spawn("python3", [pythonScript]);

  console.log("Started Python process");

  pythonProcess.on("close", (code: number) => {
    console.log("Python script process exited with code", code);
    pythonProcess = null;
  });

  if (pythonProcess.stdout) {
    pythonProcess.stdout.on("data", (data: Buffer) => {
      console.log("Python process output:", data.toString());
      io.emit("detection", data.toString());
      processing = false; // Reset processing state after receiving data
      processNextFrame(); // Process the next frame in the queue
    });
  }

  if (pythonProcess.stderr) {
    pythonProcess.stderr.on("data", (data: Buffer) => {
      console.error("Python error output:", data.toString());
    });
  }
}

function processNextFrame(): void {
  if (frameQueue.length === 0 || !pythonProcess) {
    processing = false;
    return;
  }

  if (!processing) {
    processing = true;

    const frameData = frameQueue.shift() as string[];
    const dataToSend = frameData.join(",");
    // Send data to the Python process with a newline character
    if (pythonProcess.stdin) {
      pythonProcess.stdin.write(dataToSend + "\n"); // Ensure newline for end of input
    }
  }
}

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("frame", (frameData: string[]) => {
    console.log("Received frame data");
    frameQueue.push(frameData);
    processNextFrame(); // Try to process the next frame
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

process.on("exit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

// Use PORT environment variable or default to 8088
const port: number = parseInt(process.env.PORT as string, 10) || 8088;

// Ensure the type of hostname is correct and check for `0.0.0.0` handling
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});

startPythonProcess(); // Start the Python process
