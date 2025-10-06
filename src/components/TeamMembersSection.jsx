import React from "react";
import { X, ChevronDown, ChevronUp, Users, UserPlus, Palette } from "lucide-react";
import { rolePalette, roleColor, ensureHexColor, withAlpha } from "../utils.js";
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
  const openUser = () => {
    onOpenUser?.(member.id);
  };
  const cardColor = ensureHexColor(
    member.accentColor ?? member.color ?? roleColor(member.roleType),
    roleColor(member.roleType)
  );
  const translucent = withAlpha(cardColor, 0.2);
  const handleCardClick = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('[data-team-card-control="true"]')
    ) {
      return;
    }
    openUser();
  };
  return (
    <div
      className="group glass-card p-3 flex items-center justify-between cursor-pointer border-2"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openUser();
        }
      }}
      style={{ borderColor: cardColor, backgroundColor: translucent }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: cardColor, boxShadow: `0 0 8px ${withAlpha(cardColor, 0.6)}` }}
          aria-hidden="true"
        />
        <Avatar name={member.name} roleType={member.roleType} avatar={member.avatar} />
        <span className="font-medium truncate text-left hover:underline">{member.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm group-hover:hidden">{member.roleType}</span>
        <div className="hidden group-hover:flex items-center gap-2">
          <select
            value={member.roleType}
            onChange={(e) => onUpdate(member.id, { roleType: e.target.value })}
            className="text-sm rounded-xl border border-white/60 bg-white/80 px-2 py-1 shadow-sm"
            data-team-card-control="true"
          >
            {Object.keys(rolePalette).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label
            className="glass-icon-button w-9 h-9 relative overflow-hidden"
            title="Pick card color"
            data-team-card-control="true"
          >
            <Palette className="icon" />
            <input
              type="color"
              value={cardColor}
              onChange={(e) => onUpdate(member.id, { accentColor: e.target.value })}
              aria-label={`Set card color for ${member.name}`}
              className="absolute inset-0 cursor-pointer opacity-0"
              data-team-card-control="true"
            />
          </label>
          <button
            className="glass-button text-xs px-3 py-1"
            onClick={() => onUpdate(member.id, { accentColor: null })}
            title="Reset to role color"
            aria-label={`Reset ${member.name}'s card color to role default`}
            data-team-card-control="true"
          >
            Role color
          </button>
          {(member.roleType === "LD" || member.roleType === "SME") && (
            <label
              className="text-sm inline-flex items-center gap-1 cursor-pointer text-slate-600"
              data-team-card-control="true"
            >
              <input
                type="checkbox"
                checked={courseWide.includes(member.id)}
                onChange={() => onToggleCourseWide(member.roleType, member.id)}
                data-team-card-control="true"
              />
              course-wide
            </label>
          )}
          <button
            className="glass-icon-button w-9 h-9 text-rose-500 hover:text-rose-600"
            title="Remove member"
            aria-label="Remove member"
            onClick={() => {
              onDelete(member.id);
            }}
            data-team-card-control="true"
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
    <section className="glass-surface" data-collapsed={collapsed}>
      <div className="section-header">
        <button
          type="button"
          className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 rounded-2xl"
          onClick={onToggle}
          aria-expanded={!collapsed}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-600 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)]">
            <Users className="icon icon-lg" aria-hidden="true" />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="section-title">Team Members</span>
            <span className="text-sm font-normal text-slate-700">({team.length})</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
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
                className="text-sm rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 text-slate-700 shadow-sm"
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
                className="glass-button"
                aria-label="Add member"
              >
                <UserPlus className="icon" aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand team members" : "Collapse team members"}
            className="section-toggle"
          >
            {collapsed ? <ChevronDown className="icon" /> : <ChevronUp className="icon" />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="section-body">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
        </div>
      )}
    </section>
  );
}

export { TeamMemberCard };

