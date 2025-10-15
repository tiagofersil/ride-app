import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";

// MODO TESTE: Armazenamento em memória
const testUsers = new Map();

export const auth = async (req, res) => {
  const { phone, role } = req.body;

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  // Limpar e validar número de telefone
  const cleanPhone = phone.replace(/[^0-9+]/g, ''); // Remove caracteres especiais exceto +
  
  if (cleanPhone.length < 8) {
    throw new BadRequestError("Phone number must have at least 8 digits");
  }

  if (!role || !["customer", "rider"].includes(role)) {
    throw new BadRequestError("Valid role is required (customer or rider)");
  }

  try {
    // MODO TESTE: Usar armazenamento em memória ao invés de MongoDB
    console.log(`🔐 Login attempt - Phone: ${cleanPhone}, Role: ${role}`);
    
    const userKey = `${cleanPhone}_${role}`;
    let user = testUsers.get(userKey);

    if (!user) {
      // Criar novo usuário em memória
      user = {
        _id: Math.random().toString(36).substr(2, 9),
        phone: cleanPhone,
        role,
        createdAt: new Date(),
      };
      testUsers.set(userKey, user);
      console.log(`✅ New test user created: ${cleanPhone} as ${role}`);
    } else {
      console.log(`✅ Existing test user found: ${cleanPhone} as ${role}`);
    }

    // Criar tokens simples
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET || "test_access_secret",
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "4d" }
    );

    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.REFRESH_TOKEN_SECRET || "test_refresh_secret",
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "30d" }
    );

    res.status(StatusCodes.OK).json({
      message: "User logged in successfully (TEST MODE)",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error("❌ Auth error:", error);
    throw error;
  }
};

export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      throw new UnauthenticatedError("Invalid refresh token");
    }

    const newAccessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    throw new UnauthenticatedError("Invalid refresh token");
  }
};
