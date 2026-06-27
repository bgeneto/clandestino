import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { HomePage } from './pages/HomePage.js';

function EditionPlaceholder() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
      <p>Fluxo da edição em desenvolvimento (T9/T10).</p>
    </section>
  );
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/edicao/:editionId/*" element={<EditionPlaceholder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
