import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import MicroscopeView from './pages/MicroscopeView';
import LibraryView from './pages/LibraryView';
import NotFound from './pages/NotFound';
import SessionLandingPage from './pages/SessionLandingPage';
import SessionLobbyPage from './pages/SessionLobbyPage';
import SessionStreamPage from './pages/SessionStreamPage';
import SessionLibraryPage from './pages/SessionLibraryPage';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Session flow — no Layout wrapper (each page manages its own full-screen layout) */}
        <Route path="/" element={<SessionLandingPage />} />
        <Route path="/session/:code" element={<SessionLobbyPage />} />
        <Route path="/session/:code/stream" element={<SessionStreamPage />} />
        <Route path="/session/:code/library" element={<SessionLibraryPage />} />

        {/* Standalone tool — keeps existing Layout with header and navigation */}
        <Route path="/standalone" element={<Layout><MicroscopeView /></Layout>} />
        <Route path="/standalone/library" element={<Layout><LibraryView /></Layout>} />

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
