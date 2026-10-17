import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/common/ConfirmModal";
import { useCompany } from "../contexts/CompanyContext";
import { useProject } from "../contexts/ProjectContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import API from "../api/api";
import "./header.css";

export default function Header() {
    const [projects, setProjects] = useState([]);
    const { selectedProject, setSelectedProject } = useProject();
    const { selectedCompany, setSelectedCompany } = useCompany();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const [companies, setCompanies] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef(null);
    const companyDropdownRef = useRef(null);
    const profileRef = useRef(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const isSuperAdmin = user?.email === "gadanipranav@gmail.com" || user?.role?.name === "Super Admin";
    const isOwnerOrAdmin = user?.role?.name === "Company Owner" || isSuperAdmin;

    // Dark Mode State
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.setAttribute("data-theme", "dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("theme", "light");
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const loadProjects = () => {
        API.get("/projects")
            .then((res) => {
                console.log('Projects loaded:', res.data);
                setProjects(res.data || []);
            })
            .catch((err) => {
                console.log('Error loading projects:', err);
            });
    };

    const loadCompanies = () => {
        if (!isSuperAdmin) return;
        API.get("/companies")
            .then((res) => {
                setCompanies(res.data || []);
            })
            .catch((err) => {
                console.log('Error loading companies:', err);
            });
    };

    useEffect(() => {
        loadProjects();
        if (isSuperAdmin) loadCompanies();
    }, [selectedCompany]); // Reload projects when company changes

    useEffect(() => {
        console.log('State changed:', { isDropdownOpen, selectedProject, projects: projects.length });
    }, [isDropdownOpen, selectedProject, projects]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
                setIsCompanyDropdownOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setIsDropdownOpen(false);
    };

    const handleAllProjectsClick = () => {
        console.log('All Projects clicked', { projects });
        setSelectedProject(null);
        setIsDropdownOpen(false);
    };

    const handleCompanySelect = (company) => {
        setSelectedCompany(company);
        setSelectedProject(null); // Clear selected project when company changes
        setIsCompanyDropdownOpen(false);
    };

    const handleAllCompaniesClick = () => {
        setSelectedCompany(null);
        setSelectedProject(null);
        setIsCompanyDropdownOpen(false);
    };

    return (
        <div className="app-header">
            <div className="app-header__brand">
                <div className="project-dropdown" ref={dropdownRef}>
                    <button
                        className="project-dropdown__trigger"
                        onClick={() => {
                            if (!isDropdownOpen) loadProjects();
                            setIsDropdownOpen(!isDropdownOpen);
                        }}
                    >
                        {selectedProject ? selectedProject.name : "All Projects"}
                        <span className={`project-dropdown__arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
                    </button>

                    {isDropdownOpen && (
                        <div className="project-dropdown__menu">
                            <button
                                className={`project-dropdown__item ${!selectedProject ? "active" : ""}`}
                                onClick={handleAllProjectsClick}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 7.53 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg> All Projects
                            </button>
                            {projects
                                .filter(p => {
                                    if (isSuperAdmin || user?.role?.name === "Company Owner") return true;
                                    return (p.assignedTo || []).some(m => {
                                        const memberId = (m?._id || m?.id || m)?.toString();
                                        const currentUserId = (user?._id || user?.id)?.toString();
                                        return memberId === currentUserId || (m?.email && m.email === user?.email);
                                    });
                                })
                                .map((p) => (
                                    <button
                                        key={p._id}
                                        className={`project-dropdown__item ${selectedProject?._id === p._id ? "active" : ""}`}
                                        onClick={() => handleProjectSelect(p)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.22-1.8A2 2 0 0 0 7.53 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg> {p.name}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Center: Empty tabs to keep spacing if needed */}
            <nav className="app-header__tabs">
            </nav>


            <div className="app-header__right">
                <Link to="/chat" className="theme-toggle-btn" title="Messages">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </Link>


                <button
                    onClick={toggleTheme}
                    className="theme-toggle-btn"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDarkMode ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                    )}
                </button>

                {user && (
                    <div className="profile-dropdown" ref={profileRef}>
                        <button
                            className="profile-dropdown__trigger"
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                        >
                            <div className="profile-avatar">
                                {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="profile-name">{user.name}</span>
                            <span className={`profile-dropdown__arrow ${isProfileOpen ? 'open' : ''}`}>▼</span>
                        </button>

                        {isProfileOpen && (
                            <div className="profile-dropdown__menu">
                                <div className="profile-dropdown__info">
                                    <div className="info-name">{user.name}</div>
                                    <div className="info-email">{user.email}</div>
                                </div>
                                <div className="profile-dropdown__divider"></div>

                                <div style={{ padding: '4px 12px 12px' }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{ color: 'var(--text-light)', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Account Role</div>
                                        <div style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }}></div>
                                            {(user.email === "gadanipranav@gmail.com" || user.role?.name === "Super Admin") ? "Super Admin" : user.role?.name || "User"}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ color: 'var(--text-light)', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Current Status</div>
                                        <div style={{ color: '#16a34a', fontSize: '13px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', padding: '2px 10px', borderRadius: '20px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></div>
                                            ACTIVE
                                        </div>
                                    </div>
                                </div>
                                <div className="profile-dropdown__divider"></div>

                                {isOwnerOrAdmin && (
                                    <button className="profile-dropdown__item" onClick={() => { setIsProfileOpen(false); window.location.href='/profile'; }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px' }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Company Settings
                                    </button>
                                )}

                                <div className="profile-dropdown__divider"></div>

                                <button className="profile-dropdown__item logout-item" onClick={() => setShowLogoutConfirm(true)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <ConfirmModal
                show={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={async () => {
                    await logout();
                    showToast("Logout Successful. See you soon!");
                }}
                title="Logout Confirmation"
                message="Are you sure you want to logout?"
                confirmText="Logout"
            />
        </div >
    );
}