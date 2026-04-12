import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Chat from "./pages/Chat.jsx";
import DefinirSenha from "./pages/DefinirSenha.jsx";
import Login from "./pages/Login.jsx";
import Materials from "./pages/Materials.jsx";
import Users from "./pages/Users.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="layout muted">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password && loc.pathname !== "/definir-senha") {
    return <Navigate to="/definir-senha" replace />;
  }
  if (!user.must_change_password && loc.pathname === "/definir-senha") {
    return <Navigate to="/chat" replace />;
  }
  return children;
}

function StaffRoute({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="layout muted">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password && loc.pathname !== "/definir-senha") {
    return <Navigate to="/definir-senha" replace />;
  }
  if (user.role !== "admin" && user.role !== "mentor") {
    return <Navigate to="/chat" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Navigate to="/login" replace />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Navigate to="/chat" replace />
          </PrivateRoute>
        }
      />
      <Route
        path="/definir-senha"
        element={
          <PrivateRoute>
            <DefinirSenha />
          </PrivateRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <PrivateRoute>
            <Chat />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <StaffRoute>
            <Users />
          </StaffRoute>
        }
      />
      <Route
        path="/materiais"
        element={
          <StaffRoute>
            <Materials />
          </StaffRoute>
        }
      />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
