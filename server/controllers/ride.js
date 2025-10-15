import Ride from "../models/Ride.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import {
  calculateDistance,
  calculateFare,
  generateOTP,
} from "../utils/mapUtils.js";

// Armazenamento em memória para modo teste
export const testRides = new Map();
export const testRiders = new Map();

// Função para simular motoristas disponíveis
const simulateAvailableRiders = () => {
  const mockRiders = [
    { name: "João Silva", phone: "11999999999", vehicle: "auto" },
    { name: "Maria Santos", phone: "11888888888", vehicle: "cabEconomy" },
    { name: "Pedro Costa", phone: "11777777777", vehicle: "bike" },
    { name: "Ana Oliveira", phone: "11666666666", vehicle: "cabPremium" },
  ];
  
  return mockRiders[Math.floor(Math.random() * mockRiders.length)];
};

export const createRide = async (req, res) => {
  const { vehicle, pickup, drop } = req.body;

  console.log('🚗 [CREATE RIDE] Dados recebidos:', { vehicle, pickup, drop });

  if (!vehicle || !pickup || !drop) {
    console.error('❌ [CREATE RIDE] Dados faltando:', { vehicle: !!vehicle, pickup: !!pickup, drop: !!drop });
    throw new BadRequestError("Vehicle, pickup, and drop details are required");
  }

  const {
    address: pickupAddress,
    latitude: pickupLat,
    longitude: pickupLon,
  } = pickup;

  const { address: dropAddress, latitude: dropLat, longitude: dropLon } = drop;

  if (
    !pickupAddress ||
    !pickupLat ||
    !pickupLon ||
    !dropAddress ||
    !dropLat ||
    !dropLon
  ) {
    console.error('❌ [CREATE RIDE] Coordenadas faltando:', {
      pickup: { address: !!pickupAddress, lat: !!pickupLat, lon: !!pickupLon },
      drop: { address: !!dropAddress, lat: !!dropLat, lon: !!dropLon }
    });
    throw new BadRequestError("Complete pickup and drop details are required");
  }

  const customer = req.user;

  try {
    const distance = calculateDistance(pickupLat, pickupLon, dropLat, dropLon);
    const fare = calculateFare(distance, vehicle);

    // MODO PRODUÇÃO: Criar ride em memória (sem MongoDB)
    const rideId = Math.random().toString(36).substr(2, 9);
    const ride = {
      _id: rideId,
      vehicle,
      distance,
      fare: fare[vehicle],
      pickup: {
        address: pickupAddress,
        latitude: pickupLat,
        longitude: pickupLon,
      },
      drop: { address: dropAddress, latitude: dropLat, longitude: dropLon },
      customer: customer.id,
      otp: generateOTP(),
      status: "SEARCHING_FOR_RIDER",
      createdAt: new Date(),
    };

    // Salvar em memória
    testRides.set(rideId, ride);
    
    console.log('✅ [CREATE RIDE] Ride criado em modo PRODUÇÃO:', rideId);
    console.log('🔍 [CREATE RIDE] Aguardando motoristas online para aceitar...');

    res.status(StatusCodes.CREATED).json({
      message: "Ride created successfully (PRODUCTION MODE - Aguardando motoristas)",
      ride,
    });
  } catch (error) {
    console.error('❌ [CREATE RIDE] Erro:', error);
    throw new BadRequestError("Failed to create ride");
  }
};

export const acceptRide = async (req, res) => {
  const riderId = req.user.id;
  const { rideId } = req.params;

  if (!rideId) {
    throw new BadRequestError("Ride ID is required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    if (ride.status !== "SEARCHING_FOR_RIDER") {
      throw new BadRequestError("Ride is no longer available for assignment");
    }

    ride.rider = riderId;
    ride.status = "START";
    await ride.save();

    ride = await ride.populate("rider");

    req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);
    req.socket.to(`ride_${rideId}`).emit("rideAccepted");

    res.status(StatusCodes.OK).json({
      message: "Ride accepted successfully",
      ride,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    throw new BadRequestError("Failed to accept ride");
  }
};

export const updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body;

  if (!rideId || !status) {
    throw new BadRequestError("Ride ID and status are required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer rider");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    if (!["START", "ARRIVED", "COMPLETED"].includes(status)) {
      throw new BadRequestError("Invalid ride status");
    }

    ride.status = status;
    await ride.save();

    req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);

    res.status(StatusCodes.OK).json({
      message: `Ride status updated to ${status}`,
      ride,
    });
  } catch (error) {
    console.error("Error updating ride status:", error);
    throw new BadRequestError("Failed to update ride status");
  }
};

export const getMyRides = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  try {
    // MODO PRODUÇÃO: Buscar em memória
    const rides = Array.from(testRides.values())
      .filter(ride => ride.customer === userId || ride.rider === userId)
      .filter(ride => !status || ride.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log('✅ [GET RIDES] Rides encontrados em memória:', rides.length);

    res.status(StatusCodes.OK).json({
      message: "Rides retrieved successfully (PRODUCTION MODE)",
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("Error retrieving rides:", error);
    throw new BadRequestError("Failed to retrieve rides");
  }
};
