type WorkspaceRouteLoadingProps = {
  view: "Overview" | "List" | "Calendar" | "Kanban";
};

export function WorkspaceRouteLoading({ view }: WorkspaceRouteLoadingProps) {
  return <main className="workspace-shell workspace-route-loading" aria-busy="true">
    <aside className="sidebar" aria-hidden="true"><div className="workspace-route-loading-brand" /></aside>
    <section className="workspace-main">
      <header className="workspace-header"><p className="workspace-header-context"><span>Workspace</span><span aria-hidden="true">/</span><strong>{view}</strong></p></header>
      <div className="workspace-content">
        <header className="topbar"><div><p className="eyebrow">Loading workspace</p><h1>Good morning.</h1></div></header>
        <div className="workspace-route-loading-filter" />
        <section className="panel workspace-route-loading-panel"><span /><span /><span /></section>
      </div>
    </section>
  </main>;
}
