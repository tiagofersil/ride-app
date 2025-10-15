import jwt from "jsonwebtoken";
import User from "../models/User.js";
import NotFoundError from "../errors/not-found.js";
import UnauthenticatedError from "../errors/unauthenticated.js";

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "test_access_secret");
    req.user = { id: payload.id, phone: payload.phone, role: payload.role };
    req.socket = req.io;

    // MODO TESTE: Apenas verificar o token, sem buscar no banco
    console.log(`✅ Auth middleware - User ${payload.id} authenticated`);

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);
    throw new UnauthenticatedError("Authentication invalid");
  }
};

export default auth;
