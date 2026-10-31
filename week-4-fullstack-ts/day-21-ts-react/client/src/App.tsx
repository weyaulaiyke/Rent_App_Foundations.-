import { useContext } from "react";
import AuthContext from "./context/AuthContext.jsx";
import ProtectedRoute from "./context/ProtectedRoute.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ArrearsPage from "./pages/ArrearsPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";

import { Routes, Route } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage.jsx";
import PropertiesPage from "./pages/PropertiesPage.jsx";
import PropertyPage from "./pages/PropertyPage.jsx";
import RentersPage from "./pages/RentersPage.jsx";

import Sidebar from "./components/Sidebar.jsx";

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
                    <Route path="/payments" element={<ProtectedRoute>
                        <PaymentsPage/>
                    </ProtectedRoute>} 
                    />
                    <Route path="/arrears" element={<ProtectedRoute>
                        <ArrearsPage/>
                    </ProtectedRoute>} 
                    />
                    <Route path="/register" element={<RegisterPage/>}/>
                    <Route path="/login" element={<LoginPage/>}/>
                </Routes>
            </main>
        </>
    );
}

export default App;