import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SetupBio from './pages/SetupBio';
import Matches from './pages/Matches';
import Connections from './pages/Connections';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Privacy from './pages/Privacy';
import PublicProfile from './pages/PublicProfile';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Privacy />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup-bio" element={<SetupBio />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:partnerId" element={<Chat />} />
          <Route path="/profile/:id" element={<PublicProfile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
