import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThirdwebProvider } from "thirdweb/react";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThirdwebProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThirdwebProvider>
  </StrictMode>,
)
