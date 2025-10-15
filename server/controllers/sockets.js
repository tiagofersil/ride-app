import geolib from "geolib";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Ride from "../models/Ride.js";

const onDutyRiders = new Map();

const handleSocketConnection = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.access_token;
      if (!token) return next(new Error("Authentication invalid: No token"));

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "test_access_secret");
      
      // MODO PRODUÇÃO: Apenas verificar o token (sem MongoDB)
      socket.user = { id: payload.id, role: payload.role };
      console.log('✅ [WEBSOCKET] Usuário autenticado:', payload.id, '- Role:', payload.role);
      
      next();
    } catch (error) {
      console.error("Socket Auth Error:", error);
      next(new Error("Authentication invalid: Token verification failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`User Joined: ${user.id} (${user.role})`);

    if (user.role === "rider") {
      socket.on("goOnDuty", (coords) => {
        onDutyRiders.set(user.id, { socketId: socket.id, coords });
        socket.join("onDuty");
        console.log(`rider ${user.id} is now on duty.`);
        updateNearbyriders();
      });

      socket.on("goOffDuty", () => {
        onDutyRiders.delete(user.id);
        socket.leave("onDuty");
        console.log(`rider ${user.id} is now off duty.`);
        updateNearbyriders();
      });

      socket.on("updateLocation", (coords) => {
        if (onDutyRiders.has(user.id)) {
          onDutyRiders.get(user.id).coords = coords;
          console.log(`rider ${user.id} updated location.`);
          updateNearbyriders();
          socket.to(`rider_${user.id}`).emit("riderLocationUpdate", {
            riderId: user.id,
            coords,
          });
        }
      });

      // Motorista aceita uma corrida
      socket.on("acceptRide", async (rideId) => {
        try {
          const { testRides } = await import('./ride.js');
          const ride = testRides.get(rideId);
          
          if (!ride) {
            socket.emit("error", { message: "Ride not found" });
            return;
          }

          if (ride.status !== "SEARCHING_FOR_RIDER") {
            socket.emit("error", { message: "Ride is no longer available" });
            return;
          }

          // Atualizar ride com motorista
          const updatedRide = {
            ...ride,
            rider: user.id,
            status: "RIDER_FOUND",
            riderName: "Motorista Online", // Nome do motorista
            riderPhone: "11999999999" // Telefone do motorista
          };

          testRides.set(rideId, updatedRide);

          // Notificar cliente
          io.to(`ride_${rideId}`).emit("rideUpdate", updatedRide);
          io.to(`ride_${rideId}`).emit("rideAccepted");

          console.log(`✅ [ACCEPT RIDE] Motorista ${user.id} aceitou ride ${rideId}`);
          
          // Notificar motorista
          socket.emit("rideAccepted", updatedRide);
          
        } catch (error) {
          console.error("Error accepting ride:", error);
          socket.emit("error", { message: "Error accepting ride" });
        }
      });
    }

    if (user.role === "customer") {
      socket.on("subscribeToZone", (customerCoords) => {
        socket.user.coords = customerCoords;
        sendNearbyRiders(socket, customerCoords);
      });

      socket.on("searchrider", async (rideId) => {
        try {
          // MODO PRODUÇÃO: Buscar ride em memória
          const { testRides } = await import('./ride.js');
          const ride = testRides.get(rideId);
          if (!ride) return socket.emit("error", { message: "Ride not found" });

          const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;
          console.log('🔍 [SEARCH RIDER] Buscando motoristas para ride:', rideId);

          let retries = 0;
          let rideAccepted = false;
          let canceled = false;
          const MAX_RETRIES = 30; // 5 minutos (30 x 10s)

          const retrySearch = async () => {
            if (canceled) return;
            retries++;

            console.log(`🔍 [SEARCH RIDER] Tentativa ${retries}/${MAX_RETRIES} - Buscando motoristas próximos...`);
            const riders = sendNearbyRiders(socket, { latitude: pickupLat, longitude: pickupLon }, ride);
            
            if (riders.length > 0) {
              console.log(`✅ [SEARCH RIDER] ${riders.length} motoristas encontrados próximos!`);
            } else {
              console.log(`⚠️ [SEARCH RIDER] Nenhum motorista próximo encontrado (tentativa ${retries})`);
            }
            
            if (retries >= MAX_RETRIES) {
              clearInterval(retryInterval);
              if (!rideAccepted) {
                testRides.delete(rideId);
                socket.emit("error", { message: "No riders found within 5 minutes." });
                console.log('❌ [SEARCH RIDER] Timeout - Nenhum motorista encontrado');
              }
            }
          };

          const retryInterval = setInterval(retrySearch, 10000);
          retrySearch(); // Primeira busca imediata

          socket.on("rideAccepted", () => {
            rideAccepted = true;
            clearInterval(retryInterval);
            console.log('✅ [SEARCH RIDER] Ride aceito por motorista!');
          });

          socket.on("cancelRide", async () => {
            canceled = true;
            clearInterval(retryInterval);
            testRides.delete(rideId);
            socket.emit("rideCanceled", { message: "Ride canceled" });

            if (ride.rider) {
              const riderSocket = getRiderSocket(ride.rider);
              riderSocket?.emit("rideCanceled", { message: `Customer ${user.id} canceled the ride.` });
            }
            console.log(`❌ [SEARCH RIDER] Customer ${user.id} canceled ride ${rideId}`);
          });
        } catch (error) {
          console.error("Error searching for rider:", error);
          socket.emit("error", { message: "Error searching for rider" });
        }
      });
    }

    socket.on("subscribeToriderLocation", (riderId) => {
      const rider = onDutyRiders.get(riderId);
      if (rider) {
        socket.join(`rider_${riderId}`);
        socket.emit("riderLocationUpdate", { riderId, coords: rider.coords });
        console.log(`User ${user.id} subscribed to rider ${riderId}'s location.`);
      }
    });

    socket.on("subscribeRide", async (rideId) => {
      socket.join(`ride_${rideId}`);
      console.log('🔌 [WEBSOCKET] Cliente se inscreveu no ride:', rideId);
      
      try {
        // MODO PRODUÇÃO: Buscar em memória
        const { testRides, testRiders } = await import('./ride.js');
        const rideData = testRides.get(rideId);
        
        if (rideData) {
          console.log('✅ [WEBSOCKET] Ride encontrado em memória:', rideData._id);
          socket.emit("rideData", rideData);
        } else {
          console.error('❌ [WEBSOCKET] Ride não encontrado:', rideId);
          socket.emit("error", { message: "Ride not found" });
        }
      } catch (error) {
        console.error('❌ [WEBSOCKET] Erro ao buscar ride:', error);
        socket.emit("error", { message: "Failed to receive ride data" });
      }
    });

    socket.on("disconnect", () => {
      if (user.role === "rider") onDutyRiders.delete(user.id);
      console.log(`${user.role} ${user.id} disconnected.`);
    });

    function updateNearbyriders() {
      io.sockets.sockets.forEach((socket) => {
        if (socket.user?.role === "customer") {
          const customerCoords = socket.user.coords;
          if (customerCoords) sendNearbyRiders(socket, customerCoords);
        }
      });
    }

    function sendNearbyRiders(socket, location, ride = null) {
      const nearbyriders = Array.from(onDutyRiders.values())
        .map((rider) => ({
          ...rider,
          distance: geolib.getDistance(rider.coords, location),
        }))
        .filter((rider) => rider.distance <= 60000)
        .sort((a, b) => a.distance - b.distance);

      socket.emit("nearbyriders", nearbyriders);

      if (ride) {
        console.log(`🚗 [RIDE OFFER] Enviando oferta de corrida para ${nearbyriders.length} motoristas próximos`);
        nearbyriders.forEach((rider) => {
          io.to(rider.socketId).emit("rideOffer", {
            ...ride,
            distance: geolib.getDistance(rider.coords, location),
            estimatedTime: Math.round(geolib.getDistance(rider.coords, location) / 1000 / 60) // minutos
          });
          console.log(`📱 [RIDE OFFER] Oferta enviada para motorista ${rider.socketId}`);
        });
      }

      return nearbyriders;
    }

    function getRiderSocket(riderId) {
      const rider = onDutyRiders.get(riderId);
      return rider ? io.sockets.sockets.get(rider.socketId) : null;
    }
  });
};

export default handleSocketConnection;
