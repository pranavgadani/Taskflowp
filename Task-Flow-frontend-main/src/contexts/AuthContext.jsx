import { createContext, useContext, useState, useEffect } from "react";
import API from "../api/api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On app load, fetch user from cookie (no localStorage)
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await API.get("/auth/me");
                setUser(res.data.user);
            } catch {
                setUser(null); // Not logged in
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    const login = (userData) => {
        setUser(userData); // Set in React state only
    };

    const logout = async () => {
        try {
            await API.post("/auth/logout"); // Clear httpOnly cookie
        } catch (_) { }
        setUser(null);
        localStorage.removeItem("user"); // cleanup if any
        localStorage.removeItem("token");
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
