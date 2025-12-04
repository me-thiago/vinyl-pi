import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

// Componentes compartilhados
import { ThemeProvider } from './components/theme-provider'
import { ErrorBoundary } from './components/ErrorBoundary'

// Layout com PlayerBar persistente
import { Layout } from './components/Layout'
import { PageLoader } from './components/PageLoader'
import Home from './pages/Home'

// Lazy load das páginas secundárias
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Sessions = lazy(() => import('./pages/Sessions'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Settings = lazy(() => import('./pages/Settings'))
const Diagnostics = lazy(() => import('./pages/Diagnostics'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vinyl-os-theme">
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={
                <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
              } />
              <Route path="/sessions" element={
                <Suspense fallback={<PageLoader />}><Sessions /></Suspense>
              } />
              <Route path="/sessions/:id" element={
                <Suspense fallback={<PageLoader />}><SessionDetail /></Suspense>
              } />
              <Route path="/settings" element={
                <Suspense fallback={<PageLoader />}><Settings /></Suspense>
              } />
              <Route path="/diagnostics" element={
                <Suspense fallback={<PageLoader />}><Diagnostics /></Suspense>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
