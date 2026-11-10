import React from 'react'
import ReactDOM from 'react-dom/client'
import{ BrowserRouter } from "react-router-dom"
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App'
import './index.css'
import { ThemeProvider } from "./components/ThemeSwitcher";
import "./theme.css";


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
    <ThemeProvider>
      <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
