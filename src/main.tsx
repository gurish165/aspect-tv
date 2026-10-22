import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './admin/AdminApp'
import { App } from './App'
import { loadSettings } from './lib/boothStore'
import './styles.css'

const container: HTMLElement | null = document.getElementById('root')
if (!container) throw new Error('The application root is missing')

// The same page serves both windows: the TV, and the admin window at ?admin.
const admin: boolean = new URLSearchParams(window.location.search).has('admin')
document.documentElement.dataset.window = admin ? 'admin' : 'tv'
if (admin) document.title = 'Aspect TV Admin'

void loadSettings().then((): void => {
  createRoot(container).render(<StrictMode>{admin ? <AdminApp /> : <App />}</StrictMode>)
})
