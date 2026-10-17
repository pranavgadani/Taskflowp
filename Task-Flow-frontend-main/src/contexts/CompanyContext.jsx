import { createContext, useContext, useState, useEffect } from "react";

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
    // Stores the company selected by Super Admin.
    // Setting to null means "All Companies" or no specific filter.
    const [selectedCompany, setSelectedCompany] = useState(() => {
        const saved = localStorage.getItem("selectedCompany");
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (selectedCompany) {
            localStorage.setItem("selectedCompany", JSON.stringify(selectedCompany));
        } else {
            localStorage.removeItem("selectedCompany");
        }
    }, [selectedCompany]);

    return (
        <CompanyContext.Provider value={{ selectedCompany, setSelectedCompany }}>
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompany() {
    return useContext(CompanyContext);
}
