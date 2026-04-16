import TopBar from "./TopBar";

export default function AppShell({ variant = "investigate", children }) {
  // Derive main container grid/flex based on chosen layout variant context
  const getLayoutClass = () => {
    switch (variant) {
      case "investigate":
        return "grid grid-cols-[320px_minmax(0,1fr)_360px] h-full";
      case "detail":
        return "grid grid-cols-[minmax(0,1fr)_380px] h-full";
      case "briefing":
        return "flex justify-center h-full bg-surface-2";
      default:
        return "flex h-full";
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-surface text-text-primary">
      {/* Fixed Navigation and Status Reference */}
      <div className="h-[56px] shrink-0 border-b border-border z-50 bg-surface">
        <TopBar />
      </div>

      {/* Main Dynamically Structured Interactive Pane */}
      <div className="flex-1 overflow-hidden relative">
        <div className={getLayoutClass()}>
          
          {variant === "briefing" ? (
            /* Briefing handles bounding centrally via max width margins */
            <div className="w-full max-w-3xl h-full overflow-y-auto">
               {children}
            </div>
          ) : (
            /* Nested grids define independent internal scrolling via nested styling */
             children
          )}
          
        </div>
      </div>
    </div>
  );
}
