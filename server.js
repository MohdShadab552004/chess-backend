// Import necessary libraries
import express from 'express';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import http from 'http';
import cors from 'cors';
import { randomBytes } from 'crypto';


dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
});

const port = process.env.PORT || 3000;
let waitingQueue = [];

// Store chess instances for each room
const games = {}; 
const playerRoomId = {};

app.use(cors());

app.get("/", (req, res) => {
    res.send("Welcome to Chess!");
});

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // Add new player to waiting queue
    waitingQueue.push(socket.id);
    console.log(`Player added to queue. Current queue: ${waitingQueue}`);

    // Check if there are enough players to start a game
    if (waitingQueue.length >= 2) {
        const [player1, player2] = waitingQueue.splice(0, 2);
    
        // Verify both players are still connected
        const socket1 = io.sockets.sockets.get(player1);
        const socket2 = io.sockets.sockets.get(player2);
    
        if (socket1 && socket2) {
            // Create room ID and join players
            const roomId = `room-${randomBytes(10).toString('hex')}`;
            playerRoomId[player1] = roomId;
            playerRoomId[player2] = roomId;
            
            // Create a new Chess instance for this room
            games[roomId] = new Chess();
            
            // Join both players to the room
            socket1.join(roomId);
            socket2.join(roomId);
            io.to(player1).emit("playerRole", "w");
            io.to(player2).emit("playerRole", "b");
    
            // Notify players that the game is starting
            io.to(roomId).emit("startGame", { roomId });
        } else {
            // If one or both players disconnected, re-add the connected player to the queue
            if (socket1){
                waitingQueue.push(player1);
                delete waitingQueue[player2];
                console.log("deletin plater2");
                
            } 
            if (socket2) {
                waitingQueue.push(player2);
                delete waitingQueue[player1];
                console.log("deletin plater1");

            }
        }
    }
    

    // Handle move events
    socket.on("move", (data) => {
        try {
            console.log(data);
            const { roomId, move } = data;
            if (!roomId || !move || !games[roomId]) {
                // Invalid move data or missing game instance
                socket.emit("invalidMove", move);
                return;
            }

            const chess = games[roomId];

            // Check if the move is valid
            const chessMove = chess.move(move); 
            // chess.move expects a full move object
            if (chessMove) {
                io.to(roomId).emit("move", chessMove);
            } else {
                socket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error("Error processing move:", err);
            socket.emit("invalidMove");
        }
    });

    // Handle disconnection
    socket.on("disconnection",() => {
        console.log("gooli ai hi ");

       
    })
    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
        const id = socket.id;
        
        if (playerRoomId[id]) {
            const roomId = playerRoomId[id];
            const room = io.sockets.adapter.rooms.get(roomId);
            // Check if the room exists before trying to access sockets
            console.log(io.sockets.adapter.rooms.get(roomId),2);
            if (room && room.size > 0) {
                console.log([...room],3);
                
                const remainingPlayer = [...room].find(playerId => playerId !== id);
                console.log(4);
                
                if (remainingPlayer) {
                    console.log(5);
                    
                    console.log(911,"bhai sahab");
                    
                    // Notify the remaining player that their opponent has disconnected
                    io.to(remainingPlayer).emit("clear", "Opponent has disconnected. You win!");
                    waitingQueue.push(remainingPlayer); // Add the remaining player back to the waiting queue
                    delete playerRoomId[remainingPlayer];
                    console.log(6);
                    
                }
            }
    
            // Clean up
            
            console.log(waitingQueue,"last wala hai ",9);
            
            delete games[roomId]; // Remove the game instance
            delete playerRoomId[id]; // Remove the disconnected player's room ID mapping
            console.log(10);
            
        }
    });
    
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
