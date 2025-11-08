import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import { CapturePage } from '@/pages/CapturePage';
import { RecordingsPage } from '@/pages/RecordingsPage';
import { StreamingPage } from '@/pages/StreamingPage';
import { ThemeProvider } from '@/components/theme-provider';
import { ModeToggle } from '@/components/mode-toggle';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vinyl-capture-theme">
      <Router>
        <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b bg-card">
          <div className="container mx-auto px-6">
            <div className="flex h-16 items-center space-x-8">
              <Link to="/" className="font-bold text-xl">
                🎵 Vinyl Capture
              </Link>

              <div className="flex flex-1 items-center justify-between">
                <div className="flex space-x-6">
                <NavLink
                  to="/streaming"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-primary ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`
                  }
                >
                  Streaming
                </NavLink>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-primary ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`
                  }
                >
                  Capture
                </NavLink>
                <NavLink
                  to="/recordings"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-primary ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`
                  }
                >
                  Recordings
                </NavLink>
                </div>
                <ModeToggle />
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/streaming" element={<StreamingPage />} />
            <Route path="/" element={<CapturePage />} />
            <Route path="/recordings" element={<RecordingsPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t mt-12 py-6">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            Vinyl Direct Capture v1.0.0 • High-quality audio recording
          </div>
        </footer>
      </div>
    </Router>
    </ThemeProvider>
  );
}

export default App;
