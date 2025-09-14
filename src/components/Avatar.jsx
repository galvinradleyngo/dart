import React from "react";
import { roleColor } from "../utils.js";

export default function Avatar({ name, roleType, avatar, className = "w-6 h-6 text-sm" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-medium ${className}`}
      style={avatar ? { background: roleColor(roleType) } : { background: roleColor(roleType), color: "#fff" }}
      role="img"
      aria-label={name}
    >
      {avatar || name.split(" ").map((w) => w[0]).join("")}
    </span>
  );
}
