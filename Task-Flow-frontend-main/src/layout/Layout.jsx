import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ProjectProvider } from "../contexts/ProjectContext";
import "../style/main.css";
import "../layout/layout.css";

function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ProjectProvider>
      <div className={`app ${mobileSidebarOpen ? "mobile-sidebar-active" : ""}`}>
        {/* Mobile Backdrop Overlay */}
        {mobileSidebarOpen && (
          <div
            className="mobile-sidebar-overlay"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          closeMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="main-content">
          <Header onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
          <div className="content-area">
            <Outlet />
          </div>
        </div>
      </div>
    </ProjectProvider>
  );
}

export default Layout;