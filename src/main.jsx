import React from 'react'
import { createRoot } from 'react-dom/client'
import PMApp from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PMApp />
  </React.StrictMode>
)
