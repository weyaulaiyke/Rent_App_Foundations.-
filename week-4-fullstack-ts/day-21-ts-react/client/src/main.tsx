import React from 'react'
import ReactDOM from 'react-dom/client'
import{ BrowserRouter } from "react-router-dom"
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App'
import { OrganizationProvider } from './context/OrganizationContext'
import './organization.css'
import './financial.css'
import './index.css'
import { ThemeProvider } from "./components/ThemeSwitcher";
import "./theme.css";


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
    <AuthProvider>
    <ThemeProvider>
      <OrganizationProvider>
        <App />
      </OrganizationProvider>
      </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
