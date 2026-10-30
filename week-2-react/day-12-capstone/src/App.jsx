import ArrearsPage from "./pages/ArrearsPage";
import PaymentsPage from "./pages/PaymentsPage";
import { Routes, Route } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyPage from "./pages/PropertyPage";
import RentersPage from "./pages/RentersPage";

import Sidebar from "./components/Sidebar";

function App() {
    return (
        <>
            <Sidebar />

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/properties" element={<PropertiesPage />} />
                    <Route path="/properties/:id" element={<PropertyPage />} />
                    <Route path="/renters" element={<RentersPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/arrears" element={<ArrearsPage/>}/>
                </Routes>
            </main>
        </>
    );
}

export default App;