import React from 'react'
import ReactDOM from 'react-dom/client'
import{ BrowserRouter,Route, Routes } from "react-router-dom"
import RenterPaymentPage from "./pages/RenterPaymentPage";
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App'
import './index.css'
import { ThemeProvider } from "./components/ThemeSwitcher";
import "./theme.css";


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
   <BrowserRouter>
    <ThemeProvider>
        <Routes>
            <Route path="/pay/:token" element={<RenterPaymentPage />} />
            <Route
                path="/*"
                element={
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                }
            />
        </Routes>
    </ThemeProvider>
</BrowserRouter>
  </React.StrictMode>,
);
