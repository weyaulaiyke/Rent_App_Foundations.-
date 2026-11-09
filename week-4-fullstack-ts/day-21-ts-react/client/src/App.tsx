import { useContext } from "react";
import AuthContext from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ArrearsPage from "./pages/ArrearsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ArchivedRentersPage from "./pages/ArchivedRenters";
import MaintenancePage from "./pages/MaintenancePage";

import { Routes, Route } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyPage from "./pages/PropertyPage";
import RentersPage from "./pages/RentersPage";

import Sidebar from "./components/Sidebar";

function App() {
    const auth = useContext(AuthContext);
if (!auth) throw new Error("AuthProvider missing");
const { user } = auth;
    return (
        <>
            {user && <Sidebar />}

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<ProtectedRoute>
                        <DashboardPage/>
                    </ProtectedRoute>} 
                    />
                   <Route path="/properties" element={<ProtectedRoute>
                        <PropertiesPage/>
                    </ProtectedRoute>} 
                    />
                   <Route path="/properties/:id" element={<ProtectedRoute>
                        <PropertyPage/>
                    </ProtectedRoute>} 
                    />
                   <Route path="/renters" element={<ProtectedRoute>
                        <RentersPage/>
                    </ProtectedRoute>} 
                    />
                    <Route path="/renters/archived" element={
                    <ProtectedRoute>
                        <ArchivedRentersPage />
                    </ProtectedRoute>
                } />
                    <Route path="/payments" element={<ProtectedRoute>
                        <PaymentsPage/>
                    </ProtectedRoute>} 
                    />
                    <Route path="/arrears" element={<ProtectedRoute>
                        <ArrearsPage/>
                    </ProtectedRoute>} 
                    />
                    <Route path="/maintenance" element={<MaintenancePage/>}/>
                    <Route path="/register" element={<RegisterPage/>}/>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="*" element={<p>Page not found</p>}/>
                </Routes>
            </main>
        </>
    );
}

export default App;