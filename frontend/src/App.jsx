import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import Sidebar from "./components/Sidebar";
import MobileTopBar from "./components/MobileTopBar";
import MobileTabBar from "./components/MobileTabBar";
import ChatWidget from "./components/ChatWidget";
import DashboardPage from "./pages/DashboardPage";
import TasksPage from "./pages/TasksPage";
import WorkloadPage from "./pages/WorkloadPage";
import TeamPage from "./pages/TeamPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import SqlPage from "./pages/SqlPage";
import WhatsAppPage from "./pages/WhatsAppPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

  const loadMembers = useCallback(() => {
    api.getMembers().then(setMembers).catch(console.error);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    api.getFeatures()
      .then((features) => setWhatsappEnabled(features.whatsapp === true))
      .catch(() => setWhatsappEnabled(false));
  }, []);

  useEffect(() => {
    if (!whatsappEnabled && page === "whatsapp") setPage("dashboard");
  }, [page, whatsappEnabled]);

  const bump = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar page={page} setPage={setPage} whatsappEnabled={whatsappEnabled} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <MobileTopBar />
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          {page === "dashboard" && <DashboardPage key={refreshSignal} />}
          {page === "tasks" && <TasksPage members={members} refreshSignal={refreshSignal} />}
          {page === "workload" && <WorkloadPage members={members} key={refreshSignal} />}
          {page === "team" && <TeamPage members={members} reload={loadMembers} />}
          {page === "activities" && <ActivitiesPage members={members} />}
          {whatsappEnabled && page === "whatsapp" && <WhatsAppPage />}
          {page === "settings" && <SettingsPage />}
          {/* No key={refreshSignal}: remounting would wipe the editor. */}
          {page === "sql" && (
            <SqlPage
              onDataChanged={() => {
                bump();
                loadMembers();
              }}
            />
          )}
        </main>
      </div>

      <MobileTabBar page={page} setPage={setPage} whatsappEnabled={whatsappEnabled} />
      <ChatWidget
        members={members}
        onDataChanged={() => {
          bump();
          loadMembers();
        }}
      />
    </div>
  );
}
