import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { api } from "../lib/api";
import { AppViewState, ClientData } from "../types";
import { LoginScreen } from "../screens/LoginScreen";
import { MainLayout } from "../components/MainLayout";
import { AppLoading } from "../components/AppStatus";
import { PostWorkflowBar } from "../components/PostWorkflowBar";
import { PlanningWorkflowBar } from "../components/PlanningWorkflowBar";
import { ConfirmModal } from "../modals/ConfirmModal";
import { PlannerPreviewPanel } from "./planner/PlannerPreviewPanel";
import { PlannerStrategyView } from "./planner/PlannerStrategyView";
import { PlannerCalendarGrid } from "./planner/PlannerCalendarGrid";
import { PlannerEditorForm } from "./planner/PlannerEditorForm";
import { PlannerHeaderBar } from "./planner/PlannerHeaderBar";
import { PlannerMobileNav } from "./planner/PlannerMobileNav";
import { usePlannerState, loadPersistedViewState } from "./planner/usePlannerState";
import { usePlannerActions } from "./planner/usePlannerActions";
import { AppViewSwitcher } from "../components/AppViewSwitcher";
import { rememberClientSelection, synchronizeClientUrl } from "../lib/client-selection";
import styles from "./PlannerScreen.module.css";

export function PlannerScreen() {
  const plannerState = usePlannerState();
  const {
    user,
    userLoading,
    appState,
    setAppState,
    currentClient,
    setCurrentClient,
    isRestoringClient,
    setUserRole,
    simulatedEditorRole,
    setSimulatedEditorRole,
    productionGalleryFilters,
    setProductionGalleryFilters,
    currentDate,
    setCurrentDate,
    config,
    setConfig,
    plannerFrequency,
    setPlannerFrequency,
    posts,
    setPosts,
    pendingPostsRef,
    saveTimersRef,
    saveState,
    savePostInOrder,
    selectedDateStr,
    setSelectedDateStr,
    isConfirmDeleteOpen,
    setIsConfirmDeleteOpen,
    isLeftCollapsed,
    setIsLeftCollapsed,
    isRightCollapsed,
    setIsRightCollapsed,
    mobilePane,
    setMobilePane,
    comments,
    setComments,
    newComment,
    setNewComment,
    isGeneratingPost,
    isGeneratingMonth,
    permissions,
    editorCapabilities,
    editorRoleOptions,
    parsePostingFrequency,
    daysToFrequencyText,
  } = plannerState;

  const {
    updateCurrentPost,
    generateCurrentPostFields,
    generateMonthFields,
    currentPost,
    orderedPlannedPosts,
    previousPlannedPost,
    nextPlannedPost,
    navigateToPlannedPost,
    applyWorkflowPatch,
    handleAddComment,
  } = usePlannerActions(plannerState);

  const plannerFrequencyDays = useMemo(() => parsePostingFrequency(plannerFrequency), [plannerFrequency]);
  const hasUnrecognizedFrequency = plannerFrequency.trim().length > 0 && plannerFrequencyDays.length === 0;
  const changePlannerClient = async (client: ClientData | null) => {
    if (client?.id === currentClient?.id) return;
    try {
      const pendingEntries = Object.entries(pendingPostsRef.current);
      if (pendingEntries.length && currentClient?.id) {
        await Promise.all(pendingEntries.map(([date, post]) => savePostInOrder(currentClient.id, date, post)));
      }
      Object.values(saveTimersRef.current).forEach(clearTimeout);
      saveTimersRef.current = {};
      pendingPostsRef.current = {};
      setPosts({});
      setSelectedDateStr(null);
      setComments([]);
      setCurrentClient(client);
      if (client?.id) {
        synchronizeClientUrl(client.id, currentDate);
        await rememberClientSelection(client.id).catch(() => undefined);
      } else {
        await api.updateUiPreferences({ selectedClientId: null }).catch(() => undefined);
      }
    } catch {}
  };

  const handleNavigate = (screen: string) => {
    if (screen === "home") {
      setAppState("home");
    } else if (screen === "planner") {
      setAppState("editor");
    } else {
      setAppState(screen as AppViewState);
    }
  };

  if (userLoading) return <AppLoading label="Validando sessão" />;
  if (!user) return <LoginScreen onLogin={() => setAppState(loadPersistedViewState()?.appState || "home")} />;
  if (isRestoringClient) return <AppLoading label="Restaurando contexto do cliente" />;
  if (appState === "login") return <LoginScreen onLogin={() => setAppState(loadPersistedViewState()?.appState || "home")} />;

  const isPlannerView = appState === "editor" || appState === "planner";
  if (!isPlannerView) {
    return (
      <AppViewSwitcher
        appState={appState}
        setAppState={setAppState}
        currentClient={currentClient}
        setCurrentClient={setCurrentClient}
        setUserRole={setUserRole}
        user={user}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        posts={posts}
        setSelectedDateStr={setSelectedDateStr}
        productionGalleryFilters={productionGalleryFilters}
        setProductionGalleryFilters={setProductionGalleryFilters}
        handleNavigate={handleNavigate}
        simulatedEditorRole={simulatedEditorRole}
        setSimulatedEditorRole={setSimulatedEditorRole}
        editorRoleOptions={editorRoleOptions}
      />
    );
  }

  return (
    <MainLayout
      activeScreen="planner"
      onNavigate={handleNavigate}
      currentClient={currentClient}
      onClientChange={changePlannerClient}
      headerContext={<PlannerHeaderBar selectedDateStr={selectedDateStr} setSelectedDateStr={setSelectedDateStr} navigateToPlannedPost={navigateToPlannedPost} previousPlannedPost={previousPlannedPost} nextPlannedPost={nextPlannedPost} saveState={saveState} user={user} simulatedEditorRole={simulatedEditorRole} setSimulatedEditorRole={setSimulatedEditorRole} editorRoleOptions={editorRoleOptions} workflow={currentClient?<PlanningWorkflowBar compact clientId={currentClient.id} month={format(currentDate,"yyyy-MM")} posts={posts} onRefresh={async()=>setPosts(await api.getPosts(currentClient.id))} onConfigure={()=>setAppState("client_setup")}/>:null}/>}
    >
      <div className={cn("planner-shell", styles.shell)}>
        <PlannerMobileNav mobilePane={mobilePane} setMobilePane={setMobilePane} />

        {!isLeftCollapsed && (
          <div className={cn(styles.calendarSlot, mobilePane === "calendar" && styles.mobilePaneActive)}>
            <PlannerCalendarGrid
            currentClient={currentClient}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            posts={posts}
            setPosts={setPosts}
            orderedPlannedPosts={orderedPlannedPosts}
            plannerFrequency={plannerFrequency}
            setPlannerFrequency={setPlannerFrequency}
            config={config}
            setConfig={setConfig}
            hasUnrecognizedFrequency={hasUnrecognizedFrequency}
            parsePostingFrequency={parsePostingFrequency}
            daysToFrequencyText={daysToFrequencyText}
            savePostInOrder={savePostInOrder}
            permissions={permissions}
            editorCapabilities={editorCapabilities}
            setAppState={setAppState}
            setIsConfirmDeleteOpen={setIsConfirmDeleteOpen}
            />
            {/* style-architecture-button-exception: pane edge handles are feature-specific split-view controls. */}
            <button type="button" onClick={()=>setIsLeftCollapsed(true)} aria-label="Recolher calendário lateral" title="Recolher calendário" className={cn(styles.edgeHandle, styles.edgeLeft)}><ChevronLeft/></button>
          </div>
        )}
        {isLeftCollapsed ? <>{/* style-architecture-button-exception: pane edge handles are feature-specific split-view controls. */}<button type="button" onClick={()=>setIsLeftCollapsed(false)} aria-label="Abrir calendário lateral" title="Abrir calendário" className={cn(styles.edgeHandle, styles.edgeLeft, styles.edgeClosed)}><ChevronRight/></button></> : null}

        <section className={cn(styles.editorPane, mobilePane === "editor" && styles.mobilePaneActive)}>
          {currentPost && <div className={styles.workflowBar}><PostWorkflowBar post={currentPost} onPostRefresh={applyWorkflowPatch} /></div>}
          <div className={styles.editorContent}>
            <AnimatePresence mode="wait">
              {currentPost && selectedDateStr ? (
                <motion.div key={selectedDateStr} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className={styles.editorTransition}>
                  <PlannerEditorForm
                    currentPost={currentPost}
                    currentClient={currentClient}
                    selectedDateStr={selectedDateStr}
                    updateCurrentPost={updateCurrentPost}
                    editorCapabilities={editorCapabilities}
                    isGeneratingPost={isGeneratingPost}
                    isGeneratingMonth={isGeneratingMonth}
                    generateCurrentPostFields={generateCurrentPostFields}
                    generateMonthFields={generateMonthFields}
                  />
                </motion.div>
              ) : (
                <motion.div key="strategy-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex-1 overflow-hidden">
                  <PlannerStrategyView currentClient={currentClient} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {!isRightCollapsed && (
          <aside className={cn("planner-preview-pane", styles.previewPane, mobilePane === "preview" ? "flex" : "hidden")}>
            {/* style-architecture-button-exception: pane edge handles are feature-specific split-view controls. */}
            <button type="button" onClick={()=>setIsRightCollapsed(true)} aria-label="Recolher visualizador lateral" title="Recolher visualizador" className={cn(styles.edgeHandle, styles.edgeRight)}><ChevronRight/></button>
            {currentPost ? (
              <PlannerPreviewPanel
                currentPost={currentPost}
                currentClient={currentClient}
                comments={comments}
                newComment={newComment}
                setNewComment={setNewComment}
                handleAddComment={handleAddComment}
                updateCurrentPost={updateCurrentPost}
                editorCapabilities={editorCapabilities}
              />
            ) : (
              <div className={styles.previewEmpty}>
                <CalendarIcon />
                <strong>Aguardando Seleção</strong>
                <p>Escolha uma data ou publicação para ver a prévia e interações.</p>
              </div>
            )}
          </aside>
        )}
        {isRightCollapsed ? <>{/* style-architecture-button-exception: pane edge handles are feature-specific split-view controls. */}<button type="button" onClick={()=>setIsRightCollapsed(false)} aria-label="Abrir visualizador lateral" title="Abrir visualizador" className={cn(styles.edgeHandle, styles.edgeRight, styles.edgeClosed)}><ChevronLeft/></button></> : null}
      </div>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={async () => {
          if (!currentClient) return;
          const monthDates = Object.keys(posts).filter((dateStr) => {
            const d = new Date(dateStr + "T00:00:00");
            return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
          });
          if (monthDates.length > 0) {
            await api.deletePostsBulk(currentClient.id, monthDates);
            const refreshed = await api.getPosts(currentClient.id);
            setPosts(refreshed);
          }
          setIsConfirmDeleteOpen(false);
        }}
        title="Limpar Calendário"
        message={`Isso irá excluir todos os posts do mês de ${format(currentDate, "MMMM yyyy", { locale: ptBR })}. Essa ação é irreversível.`}
      />
    </MainLayout>
  );
}
