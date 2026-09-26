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

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const loadMembers = useCallback(() => {
    api.getMembers().then(setMembers).catch(console.error);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const bump = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar page={page} setPage={setPage} />

      <div className="flex min-h-screen flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          {page === "dashboard" && <DashboardPage key={refreshSignal} />}
          {page === "tasks" && <TasksPage members={members} refreshSignal={refreshSignal} />}
          {page === "workload" && <WorkloadPage members={members} key={refreshSignal} />}
          {page === "team" && <TeamPage members={members} reload={loadMembers} />}
          {page === "activities" && <ActivitiesPage members={members} />}
        </main>
      </div>

      <MobileTabBar page={page} setPage={setPage} />
      <ChatWidget
        onDataChanged={() => {
          bump();
          loadMembers();
        }}
      />
    </div>
  );
}
