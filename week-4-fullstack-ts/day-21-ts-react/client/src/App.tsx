import { useContext } from "react";
import AuthContext from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ArrearsPage from "./pages/ArrearsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ArchivedRentersPage from "./pages/ArchivedRenters";
import MaintenancePage from "./pages/MaintenancePage";
import SettingsPage from "./pages/SettingsPage";
import CompanyDashboardPage from "./pages/CompanyDashboardPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

import { Routes, Route, useLocation } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyPage from "./pages/PropertyPage";
import RentersPage from "./pages/RentersPage";

import Sidebar from "./components/Sidebar";

function App() {
    const { pathname } = useLocation();
    const isAuthPage = pathname === "/login" || pathname === "/register" || "/verify-email";
    const auth = useContext(AuthContext);
if (!auth) throw new Error("AuthProvider missing");
const { user } = auth;
    return (
        <>
            {user && !isAuthPage && <Sidebar />}

            <main 
                className={
                    isAuthPage
                        ? "main-content main-content--auth"
                        : "main-content"
                }>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute requiredWorkspaceType="PERSONAL">
                                <DashboardPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/company"
                        element={
                            <ProtectedRoute requiredWorkspaceType="COMPANY">
                                <CompanyDashboardPage />
                            </ProtectedRoute>
                        }
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
                    <Route path="/maintenance" element={<ProtectedRoute><MaintenancePage/></ProtectedRoute>}/>
                    <Route path="/register" element={<RegisterPage/>}/>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="/verify-email"element={<VerifyEmailPage />}/>
                    <Route path="*" element={<p>Page not found</p>}/>
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage/></ProtectedRoute>}/>
                </Routes>
            </main>
        </>
    );
}

export default App;