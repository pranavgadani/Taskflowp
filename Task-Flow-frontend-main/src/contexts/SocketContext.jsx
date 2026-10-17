import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

const SOCKET_URL = window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://task-flow-backend-jiwe.onrender.com";

export function SocketProvider({ children }) {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Create socket connection
        socketRef.current = io(SOCKET_URL);

        socketRef.current.on("connect", () => {
            console.log("⚡ Socket.io connected:", socketRef.current.id);
            setConnected(true);
        });

        socketRef.current.on("disconnect", () => {
            console.log("❌ Socket.io disconnected");
            setConnected(false);
        });

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
