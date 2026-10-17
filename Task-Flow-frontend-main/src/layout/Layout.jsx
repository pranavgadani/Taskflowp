import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ProjectProvider } from "../contexts/ProjectContext";
import "../style/main.css";
import "../layout/layout.css";

function Layout() {
  return (
    <ProjectProvider>
      <div className="app">
        <Sidebar />
        <div className="main-content">
          <Header />
          <div className="content-area">
            <Outlet />
          </div>
        </div>
      </div>
    </ProjectProvider>
  );
}

export default Layout;