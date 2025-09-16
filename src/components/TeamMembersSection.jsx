import React from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { rolePalette } from "../utils.js";
import Avatar from "./Avatar.jsx";

function TeamMemberCard({
  member,
  courseLDIds = [],
  courseSMEIds = [],
  onUpdate,
  onDelete,
  onToggleCourseWide,
  onOpenUser,
}) {
  const courseWide = member.roleType === "LD" ? courseLDIds : courseSMEIds;
  return (
    <div className="group rounded-xl border border-black/10 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <Avatar name={member.name} roleType={member.roleType} avatar={member.avatar} />
        <button
          onClick={() => onOpenUser(member.id)}
          className="font-medium truncate text-left hover:underline"
        >
          {member.name}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm group-hover:hidden">{member.roleType}</span>
        <div className="hidden group-hover:flex items-center gap-2">
          <select
            value={member.roleType}
            onChange={(e) => onUpdate(member.id, { roleType: e.target.value })}
            className="text-sm"
          >
            {Object.keys(rolePalette).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {(member.roleType === "LD" || member.roleType === "SME") && (
            <label className="text-sm inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={courseWide.includes(member.id)}
                onChange={() => onToggleCourseWide(member.roleType, member.id)}
              />
              course-wide
            </label>
          )}
          <button
            className="text-black/40 hover:text-red-500"
            title="Remove member"
            aria-label="Remove member"
            onClick={() => onDelete(member.id)}
          >
            <X className="icon" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamMembersSection({
  team = [],
  people = [],
  onAddMember,
  onAddExistingMember,
  onUpdateMember,
  onDeleteMember,
  onToggleCourseWide,
  onOpenUser,
  courseLDIds = [],
  courseSMEIds = [],
  collapsed = false,
  onToggle = () => {},
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 px-1 cursor-pointer"
        onClick={onToggle}
      >
        <h2 className="font-semibold flex items-center gap-2">
          👥︎ Team Members
          <span className="text-sm font-normal text-black/60">({team.length})</span>
        </h2>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!collapsed && (
            <>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onAddExistingMember(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="text-sm"
              >
                <option value="">Add existing...</option>
                {people
                  .filter((p) => !team.some((m) => m.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={onAddMember}
                className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm bg-white border border-black/10 shadow-sm hover:bg-slate-50"
                aria-label="Add member"
              >
                <Plus className="icon" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand team members" : "Collapse team members"}
            className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-black/10 bg-white text-slate-600 hover:bg-slate-50"
          >
            {collapsed ? <ChevronDown className="icon" /> : <ChevronUp className="icon" />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {team.map((m) => (
            <TeamMemberCard
              key={m.id}
              member={m}
              courseLDIds={courseLDIds}
              courseSMEIds={courseSMEIds}
              onUpdate={onUpdateMember}
              onDelete={onDeleteMember}
              onToggleCourseWide={onToggleCourseWide}
              onOpenUser={onOpenUser}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export { TeamMemberCard };

