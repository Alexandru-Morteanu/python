import { createServer } from "http";
import { Server } from "socket.io";
import Elysia from "elysia";
import { spawn } from "child_process";
import path from "path";

const app = new Elysia();
const httpServer = createServer(app); // Create HTTP server with Elysia app

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let pythonProcess;
const frameQueue = [];
let processing = false;

function startPythonProcess() {
  const pythonScript = path.resolve(
    "/Users/morteanualexandru/Desktop/pinbin/backend/py.py"
  );
  pythonProcess = spawn("python3", [pythonScript]);

  console.log("Started Python process");

  pythonProcess.on("close", (code) => {
    console.log("Python script process exited with code", code);
    pythonProcess = null;
  });

  pythonProcess.stdout.on("data", (data) => {
    console.log("Python process output:", data.toString());
    io.emit("detection", data.toString());
    processing = false; // Reset processing state after receiving data
    processNextFrame(); // Process the next frame in the queue
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python error output:", data.toString());
  });
}

function processNextFrame() {
  if (frameQueue.length === 0 || !pythonProcess) {
    processing = false;
    return;
  }

  if (!processing) {
    processing = true;

    const frameData = frameQueue.shift();
    const dataToSend = frameData.join(",");
    // Send data to the Python process with a newline character
    pythonProcess.stdin.write(dataToSend + "\n"); // Ensure newline for end of input
  }
}

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("frame", (frameData) => {
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

const port = 8088;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

startPythonProcess(); // Start the Python process
