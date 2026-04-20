"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Moon, CheckCircle2, AlertTriangle, Scan, ListTodo, Pencil, Loader2, Eye, EyeOff } from "lucide-react";
import { useUpdateBriefingSection } from "@/hooks/useBriefing";

const SECTION_CONFIG = {
  whatHappened:  { label: "What Happened Last Night", Icon: Moon,          iconClass: "text-text-secondary" },
  harmlessEvents:{ label: "Cleared — No Action Required", Icon: CheckCircle2,  iconClass: "text-severity-harmless" },
  escalations:   { label: "Requires Escalation",        Icon: AlertTriangle, iconClass: "text-severity-escalate" },
  droneFindings: { label: "Drone Patrol Findings",       Icon: Scan,          iconClass: "text-agent-blue" },
  followUpItems: { label: "Requires Follow-Up",          Icon: ListTodo,      iconClass: "text-severity-monitor" },
};

export default function BriefingSection({ sectionName, sectionData, briefingId, isApproved }) {
  const config = SECTION_CONFIG[sectionName] || { label: sectionName, Icon: Moon, iconClass: "text-text-secondary" };
  const { Icon, label, iconClass } = config;

  const { agentDraft = "", mayaVersion = null, isEdited = false } = sectionData || {};
  const currentContent = isEdited && mayaVersion ? mayaVersion : agentDraft;

  const [isEditMode, setIsEditMode] = useState(false);
  const [editValue, setEditValue] = useState(currentContent);
  const [showAgentDraft, setShowAgentDraft] = useState(false);
  const autoSaveTimer = useRef(null);

  const { mutate: updateSection, isPending } = useUpdateBriefingSection();

  // Keep draft in sync when props refresh
  useEffect(() => { setEditValue(currentContent); }, [currentContent]);

  const save = useCallback((value) => {
    if (!briefingId) return;
    updateSection({ briefingId, sectionName, content: value });
  }, [briefingId, sectionName, updateSection]);

  const handleChange = (e) => {
    setEditValue(e.target.value);
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(e.target.value), 2000);
  };

  const handleSave = () => {
    clearTimeout(autoSaveTimer.current);
    save(editValue);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setEditValue(currentContent);
    setIsEditMode(false);
  };

  const wordCount = editValue.trim() ? editValue.trim().split(/\s+/).length : 0;

  return (
    <section className="px-8 py-8 group print:px-0 print:py-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="flex items-center gap-4">
          <Icon className={`w-5 h-5 ${iconClass} shrink-0`} />
          <h2 className="text-white font-bold text-base tracking-tight">{label}</h2>
          {isEdited ? (
            <span className="font-mono text-[10px] px-2 py-0.5 border border-amber-500/50 bg-amber-500/10 text-amber-500 uppercase tracking-widest">Edited by Maya</span>
          ) : (
            <span className="font-mono text-[10px] px-2 py-0.5 border border-agent-blue/40 bg-agent-blue/10 text-agent-blue uppercase tracking-widest">Agent draft</span>
          )}
        </div>

        {!isApproved && !isEditMode && (
          <button
            onClick={() => setIsEditMode(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-text-muted hover:text-white font-mono text-[10px] uppercase tracking-widest"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      {/* Print header */}
      <div className="hidden print:flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
        <h2 className="font-bold text-base text-black">{label}</h2>
      </div>

      {/* EDIT MODE */}
      {isEditMode ? (
        <div className="flex flex-col gap-4 print:hidden">
          <textarea
            disabled={isPending}
            value={editValue}
            onChange={handleChange}
            className="w-full min-h-[160px] bg-surface border border-border text-text-primary text-sm leading-relaxed p-4 font-sans resize-none focus:outline-none focus:border-agent-blue/50 disabled:opacity-50 transition-colors"
          />

          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-text-muted">{wordCount} words</span>
            <div className="flex items-center gap-4">
              <button onClick={handleCancel} className="font-mono text-[10px] text-text-muted hover:text-white uppercase tracking-widest transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 bg-agent-blue hover:bg-agent-blue/90 text-white font-mono text-[10px] uppercase tracking-widest px-4 py-2 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE */
        <div>
          {sectionName === "escalations" && Array.isArray(sectionData?.items) && sectionData.items.length > 0 ? (
            <div className="flex flex-col gap-4">
              {sectionData.items.map((item, i) => (
                <div key={i} className="border-l-4 border-severity-escalate bg-severity-escalate/5 px-5 py-4 rounded-r-sm">
                  <p className="text-text-primary text-sm leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-primary whitespace-pre-wrap text-[16px] leading-[1.75]">{currentContent || <span className="text-text-muted italic">No content yet.</span>}</p>
          )}

          {/* Agent draft comparison toggle */}
          {isEdited && !isApproved && (
            <div className="mt-4 print:hidden">
              <button
                onClick={() => setShowAgentDraft(!showAgentDraft)}
                className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted hover:text-text-secondary uppercase tracking-widest transition-colors"
              >
                {showAgentDraft ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showAgentDraft ? "Hide" : "Show"} agent draft
              </button>
              {showAgentDraft && (
                <div className="mt-2 p-4 bg-surface border border-border text-text-muted text-sm leading-relaxed whitespace-pre-wrap italic">
                  {agentDraft}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
