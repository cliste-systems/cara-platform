"use client";
import { useId, useState, type ReactNode } from "react";
export function AdminWorkspaceTabs({ panels, initialId }: { panels: { id: string; label: string; content: ReactNode }[]; initialId?: string }) {
  const uid = useId();
  const [selected, setSelected] = useState(initialId || panels[0]?.id);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div role="tablist" aria-label="Workspace sections" className="flex shrink-0 gap-5 overflow-x-auto border-b border-[#e0e3e6]">
      {panels.map((panel, index) => <button key={panel.id} id={`${uid}-${panel.id}-tab`} type="button" role="tab" aria-selected={selected === panel.id} aria-controls={`${uid}-${panel.id}-panel`} tabIndex={selected === panel.id ? 0 : -1} onClick={() => setSelected(panel.id)} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const target = event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + panels.length) % panels.length; setSelected(panels[target].id); document.getElementById(`${uid}-${panels[target].id}-tab`)?.focus(); }} className={`shrink-0 whitespace-nowrap border-b-2 pb-3 text-[13px] font-medium outline-offset-4 ${selected === panel.id ? "border-[#353d42] text-[#11181d]" : "border-transparent text-[#697078] hover:text-[#11181d]"}`}>{panel.label}</button>)}
    </div>
    {panels.map(panel => <div key={panel.id} role="tabpanel" id={`${uid}-${panel.id}-panel`} aria-labelledby={`${uid}-${panel.id}-tab`} hidden={selected !== panel.id} className="min-h-0 flex-1 overflow-y-auto pt-4">{panel.content}</div>)}
  </div>;
}
