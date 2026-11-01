import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { DemoSessionProvider } from './auth/DemoSession.jsx'
import { BillWorkflowProvider } from './features/bill-review/BillWorkflowContext.jsx'
import { InventoryProvider } from './features/store-keeper/InventoryContext.jsx'
import { SiteProvider } from './features/site-engineer/SiteContext.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DemoSessionProvider>
        <BillWorkflowProvider>
          <InventoryProvider>
            <SiteProvider>
              <App />
            </SiteProvider>
          </InventoryProvider>
        </BillWorkflowProvider>
      </DemoSessionProvider>
    </BrowserRouter>
  </React.StrictMode>
)
