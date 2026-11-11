import BillingPage from "./pages/BillingPage";
import PaymentReturnPage from "./pages/PaymentReturnPage";
import { useContext } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import AuthContext from "./context/AuthContext";
import { useOrganization } from "./context/OrganizationContext";
import ProtectedRoute from "./context/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyPage from "./pages/PropertyPage";
import RentersPage from "./pages/RentersPage";
import ArchivedRentersPage from "./pages/ArchivedRenters";
import PaymentsPage from "./pages/PaymentsPage";
import ArrearsPage from "./pages/ArrearsPage";
import MaintenancePage from "./pages/MaintenancePage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";

function App() {
    const { pathname } = useLocation();
    const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/payment-return";
    const auth = useContext(AuthContext);
    const { organization } = useOrganization();
    if (!auth) throw new Error("AuthProvider missing");
    return <>
        {auth.user && !isAuthPage && <Sidebar />}
        {/* A workspace switch discards the old workspace's forms and component state. Auth forms keep a stable key. */}
        <main key={isAuthPage ? "authentication" : `workspace:${organization?.id ?? "pending"}`}
            className={isAuthPage ? "main-content main-content--auth" : "main-content"}>
            <Routes>
                <Route path="/payment-return" element={<PaymentReturnPage />} />
                <Route path="/billing" element={<ProtectedRoute permission="finance:read"><BillingPage /></ProtectedRoute>} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
                <Route path="/properties/:id" element={<ProtectedRoute><PropertyPage /></ProtectedRoute>} />
                <Route path="/renters" element={<ProtectedRoute><RentersPage /></ProtectedRoute>} />
                <Route path="/renters/archived" element={<ProtectedRoute><ArchivedRentersPage /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute permission="finance:read"><PaymentsPage /></ProtectedRoute>} />
                <Route path="/arrears" element={<ProtectedRoute permission="finance:read"><ArrearsPage /></ProtectedRoute>} />
                <Route path="/maintenance" element={<ProtectedRoute><MaintenancePage /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute permission="members:manage"><UsersPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<p>Page not found</p>} />
            </Routes>
        </main>
    </>;
}
export default App;
