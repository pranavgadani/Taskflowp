import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import API from "../api/api";
import { useToast } from "../contexts/ToastContext";
import { CloseIcon } from "../components/common/Icons";
import "../style/login.css";

const FeatureBox = ({ icon, title, desc }) => (
    <div className="feature-box">
        <div className="feature-icon-circle">{icon}</div>
        <h3>{title}</h3>
        <p>{desc}</p>
    </div>
);

export default function Login() {
    const navigate = useNavigate();
    const { user, login: setAuthUser } = useAuth();
    const { showToast } = useToast();
    useEffect(() => {
        if (user) {
            navigate("/");
        }
    }, [user, navigate]);

    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                }
            });
        }, { threshold: 0.1 });

        const hiddenElements = document.querySelectorAll('.reveal-hidden');
        hiddenElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    const login = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await API.post("/auth/login", loginForm);
            const user = res.data.user;
            const token = res.data.token;
            if (token) localStorage.setItem("token", token);
            
            setAuthUser(user);
            showToast("Login Successful!");
            navigate("/");
        } catch (err) {
            showToast(err.response?.data?.error || "Invalid Credentials", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* STICKY HEADER */}
            <header className="landing-header animate-fade-down">
                <div className="landing-logo">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span>TaskFlow</span>
                </div>

                <div className="header-login-container" style={{ display: "flex", gap: "12px" }}>
                    <button
                        type="button"
                        className="header-login-btn"
                        onClick={() => setShowLoginForm(true)}
                    >
                        Sign In
                    </button>
                </div>
            </header>

            {/* FULLSCREEN LOGIN MODAL */}
            {showLoginForm && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)",
                    backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
                    justifyContent: "center", zIndex: 9999
                }}>
                    <div style={{
                        maxWidth: "450px", width: "90%", background: "#fff",
                        padding: "40px", borderRadius: "24px", position: "relative",
                        animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
                    }}>
                        <button
                            type="button"
                            onClick={() => setShowLoginForm(false)}
                            style={{
                                position: "absolute", top: "20px", right: "20px",
                                background: "#f1f5f9", border: "none", width: "36px", height: "36px",
                                borderRadius: "50%", cursor: "pointer",
                                color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                        ><CloseIcon size={16} /></button>

                        <div style={{ textAlign: "center", marginBottom: "30px", marginTop: "10px" }}>
                            <div style={{
                                width: "60px", height: "60px", background: "#e0e7ff",
                                borderRadius: "18px", display: "flex", alignItems: "center",
                                justifyContent: "center", margin: "0 auto 20px", color: "#4f46e5"
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                                </svg>
                            </div>
                            <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>Welcome Back</h2>
                            <p style={{ color: "#64748b", marginTop: "8px", fontSize: "15px" }}>Login to access your workspace.</p>
                        </div>

                        <form onSubmit={login}>
                            <div className="form-group">
                                <label className="input-label">Email Address</label>
                                <input
                                    className="input-field"
                                    type="email"
                                    placeholder="name@company.com"
                                    required
                                    autoFocus
                                    value={loginForm.email}
                                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="input-label">Password</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        className="input-field"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        required
                                        value={loginForm.password}
                                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                        style={{ paddingRight: "45px" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: "absolute", right: "12px", top: "50%",
                                            transform: "translateY(-50%)", background: "none",
                                            border: "none", cursor: "pointer", color: "#64748b",
                                            display: "flex", alignItems: "center", justifyContent: "center"
                                        }}
                                    >
                                        {showPassword ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <span onClick={() => { setShowLoginForm(false); navigate("/forgot-password"); showToast("Reset password not fully hooked up in this demo.", "info"); }} className="forgot-password-link">
                                    Forgot password?
                                </span>
                            </div>

                            <button className="submit-button" type="submit" disabled={loading} style={{ marginTop: "15px" }}>
                                {loading ? "Signing in..." : "Sign In to Workspace"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* HERO SECTION */}
            <section className="hero-sec">
                <div className="hero-blob blob-1"></div>
                <div className="hero-blob blob-2"></div>
                <div className="hero-content-wrapper">
                    <h1 className="animate-fade-up">The Operating System for Modern Teams</h1>
                    <p className="animate-fade-up delay-100">
                        Streamline your workflow, collaborate in real-time, and manage everything
                        from tasks to documents in one powerful, unified workspace.
                    </p>
                    <div className="hero-cta animate-scale-in delay-200">
                        <button onClick={() => setShowLoginForm(true)} className="primary-cta" style={{ background: "#4f46e5" }}>Sign In to Workspace</button>
                    </div>
                </div>
            </section>

            {/* ... Rest of components ... */}
            {/* FEATURES SECTION */}
            <section id="features" className="landing-section">
                <div className="section-title reveal-hidden">
                    <h2>Everything you need to ship faster</h2>
                    <p>Powerful features to help you manage work without the stress.</p>
                </div>

                <div className="features-grid">
                    <div className="reveal-hidden">
                        <FeatureBox
                            title="Task & Status Management"
                            desc="Organize tasks with custom statuses. Track your team's daily progress through clean, filterable lists."
                            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                        />
                    </div>
                    <div className="reveal-hidden reveal-delay-1">
                        <FeatureBox
                            title="Advanced Document System"
                            desc="Create, share, and manage company documents. Keep all your contracts and briefs in one secure vault."
                            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
                        />
                    </div>
                    <div className="reveal-hidden reveal-delay-2">
                        <FeatureBox
                            title="Organization Control"
                            desc="Manage staff, teams, and departments. Onboard hundreds of employees and assign them to specific units."
                            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                        />
                    </div>
                    <div className="reveal-hidden reveal-delay-3">
                        <FeatureBox
                            title="Subscription Plans"
                            desc="Manage workspace access with tiered plans. Keep your organization running with flexible subscription options."
                            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                        />
                    </div>
                </div>
            </section>


            {/* BUILT FOR ROLES SECTION */}
            <section className="landing-section" style={{ background: "#fff" }}>
                <div className="section-title reveal-hidden">
                    <h2>Built for Every Role</h2>
                    <p>Specific tools for every level of your organization.</p>
                </div>

                <div className="reveal-hidden" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", maxWidth: "1200px", margin: "0 auto" }}>
                    <div style={{ padding: "32px", borderRadius: "24px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#4f46e5", fontWeight: "900", fontSize: "12px", textTransform: "uppercase", marginBottom: "10px" }}>Super Admin</div>
                        <h4 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "12px" }}>Global Control</h4>
                        <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>Manage all registered companies, update global subscription plans, and monitor system-wide activity.</p>
                    </div>
                    <div style={{ padding: "32px", borderRadius: "24px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#6366f1", fontWeight: "900", fontSize: "12px", textTransform: "uppercase", marginBottom: "10px" }}>Company Owner</div>
                        <h4 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "12px" }}>Workspace Autonomy</h4>
                        <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>Configure your own branding, manage your staff list, set up custom task statuses, and handle billing.</p>
                    </div>
                    <div style={{ padding: "32px", borderRadius: "24px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#818cf8", fontWeight: "900", fontSize: "12px", textTransform: "uppercase", marginBottom: "10px" }}>Staff Member</div>
                        <h4 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "12px" }}>Daily Execution</h4>
                        <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>Access your assigned projects, update tasks on the kanban board, and collaborate on shared documents.</p>
                    </div>
                </div>
            </section>

            {/* ABOUT US SECTION */}
            <section id="about" className="landing-section reveal-hidden" style={{ background: "#fff", borderTop: "1px solid #f1f5f9" }}>
                <div className="section-title">
                    <h2>About TaskFlow</h2>
                    <p>Built for teams that refuse to accept chaos as the default.</p>
                </div>

                <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", color: "#475569", fontSize: "18px", lineHeight: "1.8" }}>
                    <p style={{ margin: "0 20px 24px" }}>
                        We started TaskFlow with a simple mission: to eliminate the friction between having an idea and executing it. In a world full of disjointed chat apps, scattered documents, and overly complex project management systems, we set out to build a clean, unified workspace.
                    </p>
                    <p style={{ margin: "0 20px" }}>
                        Today, our platform empowers thousands of organizations—from agile startups to robust enterprises—helping them stay aligned, scale rapidly, and focus on what truly matters: doing great work.
                    </p>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <div className="footer-logo">TaskFlow</div>
                <div className="footer-links">
                    <span onClick={() => {
                        const el = document.getElementById("features");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}>Features</span>

                    <span onClick={() => {
                        const el = document.getElementById("about");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}>About Us</span>
                    <span onClick={() => showToast("Full 'Privacy Policy' will be available before launch.", "info")}>Privacy Policy</span>
                </div>
                <div className="footer-copyright">
                    © 2026 TaskFlow Management Systems. All rights reserved.
                </div>
            </footer>
        </div>
    );
}