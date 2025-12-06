import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { Toaster } from 'sonner'
import './index.css'

// Initialize i18n before any component renders
import './i18n'

// Inicializar Sentry para error tracking
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN, // Só habilita se DSN configurado
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Performance Monitoring - 10% das transações
  tracesSampleRate: 0.1,
  // Session Replay - 10% normal, 100% quando há erro
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

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
const Collection = lazy(() => import('./pages/Collection'))
const CollectionDetail = lazy(() => import('./pages/CollectionDetail'))
const Stats = lazy(() => import('./pages/Stats'))

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
              <Route path="/collection" element={
                <Suspense fallback={<PageLoader />}><Collection /></Suspense>
              } />
              <Route path="/collection/:id" element={
                <Suspense fallback={<PageLoader />}><CollectionDetail /></Suspense>
              } />
              <Route path="/stats" element={
                <Suspense fallback={<PageLoader />}><Stats /></Suspense>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
