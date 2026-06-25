import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/shell/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetails } from './pages/ProjectDetails';
import { Resources } from './pages/Resources';
import { Board } from './pages/Board';
import { Summary } from './pages/Summary';
import { Graphs } from './pages/Graphs';
import { Reports } from './pages/Reports';
import { Admin } from './pages/Admin';
import { Search } from './pages/Search';
import { MyAllocation } from './pages/MyAllocation';
import { NotFound } from './pages/NotFound';
import { useAppStore } from './store/appStore';

/** Role-aware landing: Staff land on My Allocation, never the Master/Admin dashboard. */
function RoleHome() {
  const role = useAppStore((s) => s.role);
  return role === 'staff' ? <Navigate to="/me" replace /> : <Dashboard />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<RoleHome />} />
        <Route path="/me" element={<MyAllocation />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/board" element={<Board />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/graphs" element={<Graphs />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/search" element={<Search />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
