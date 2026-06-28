import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { HomePage } from './pages/HomePage.js';
import { EditionLayout } from './pages/edition/EditionLayout.js';
import { MyGroupPage } from './pages/edition/MyGroupPage.js';
import { MyMatchesPage } from './pages/edition/MyMatchesPage.js';
import { PlayerEntryPage } from './pages/edition/PlayerEntryPage.js';
import { PlayerStandingsPage } from './pages/edition/PlayerStandingsPage.js';
import { PublicEditionPage } from './pages/edition/PublicEditionPage.js';
import { RegisterResultPage } from './pages/edition/RegisterResultPage.js';
import { RequirePlayerSession } from './pages/edition/RequirePlayerSession.js';
import { ChampionshipPage } from './pages/organizer/ChampionshipPage.js';
import { CreateChampionshipPage } from './pages/organizer/CreateChampionshipPage.js';
import { CreateEditionPage } from './pages/organizer/CreateEditionPage.js';
import { ImportCsvPage } from './pages/organizer/ImportCsvPage.js';
import { OrganizerDashboardPage } from './pages/organizer/OrganizerDashboardPage.js';
import { OrganizerEditionPage } from './pages/organizer/OrganizerEditionPage.js';
import { OrganizerLayout } from './pages/organizer/OrganizerLayout.js';
import { OrganizerLoginPage } from './pages/organizer/OrganizerLoginPage.js';
import { OrganizerVerifyPage } from './pages/organizer/OrganizerVerifyPage.js';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/edicao/:editionId" element={<EditionLayout />}>
          <Route index element={<PublicEditionPage />} />
          <Route path="entrar" element={<PlayerEntryPage />} />
          <Route element={<RequirePlayerSession />}>
            <Route path="partidas" element={<MyMatchesPage />} />
            <Route path="partidas/:matchId/registrar" element={<RegisterResultPage />} />
            <Route path="grupo" element={<MyGroupPage />} />
            <Route path="classificacao" element={<PlayerStandingsPage />} />
          </Route>
        </Route>
        <Route path="/organizador">
          <Route index element={<OrganizerLoginPage />} />
          <Route path="entrar" element={<OrganizerVerifyPage />} />
          <Route element={<OrganizerLayout />}>
            <Route path="painel" element={<OrganizerDashboardPage />} />
            <Route path="campeonato/novo" element={<CreateChampionshipPage />} />
            <Route path="campeonato/:championshipId" element={<ChampionshipPage />} />
            <Route path="campeonato/:championshipId/edicao/nova" element={<CreateEditionPage />} />
            <Route path="campeonato/:championshipId/importar" element={<ImportCsvPage />} />
            <Route path="edicao/:editionId" element={<OrganizerEditionPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
