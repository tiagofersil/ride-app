import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io'; 
import connectDB from './config/connect.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import authMiddleware from './middleware/authentication.js';

// Routers
import authRouter from './routes/auth.js';
import rideRouter from './routes/ride.js';

// Import socket handler
import handleSocketConnection from './controllers/sockets.js';

dotenv.config();

EventEmitter.defaultMaxListeners = 20;

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new socketIo(server, { cors: { origin: "*" } });

// Attach the WebSocket instance to the request object
app.use((req, res, next) => {
  req.io = io;
  return next();
});

// Initialize the WebSocket handling logic
handleSocketConnection(io);

// Test route
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Ride App Server is running!",
    mode: "TEST MODE - Memory Storage",
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use("/auth", authRouter);
app.use("/ride", authMiddleware, rideRouter);

// Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    // MODO TESTE: Tentar conectar ao MongoDB, mas continuar mesmo se falhar
    if (process.env.MONGO_URI) {
      try {
        await connectDB(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");
      } catch (dbError) {
        console.log("⚠️  MongoDB not connected - Running in TEST MODE (memory storage)");
        console.log("   Error:", dbError.message);
      }
    } else {
      console.log("⚠️  No MONGO_URI found - Running in TEST MODE (memory storage)");
    }

    server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
      console.log(
        `🚀 HTTP server is running on port http://localhost:${process.env.PORT || 3000}`
      )
    );
  } catch (error) {
    console.log("❌ Server start error:", error);
  }
};

start();
