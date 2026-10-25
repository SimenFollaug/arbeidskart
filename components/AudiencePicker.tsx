"use client";

import type { Audience, AppUser } from "@/lib/types";

interface AudiencePickerProps {
  users: AppUser[];
  currentUserId: string;
  audience: Audience;
  recipientIds: string[];
  onAudienceChange: (a: Audience) => void;
  onRecipientsChange: (ids: string[]) => void;
}

export function AudiencePicker({
  users,
  currentUserId,
  audience,
  recipientIds,
  onAudienceChange,
  onRecipientsChange,
}: AudiencePickerProps) {
  // The author always sees their own item, so leave them out of the picker.
  const selectable = users.filter((u) => u.id !== currentUserId);

  function toggle(id: string) {
    if (recipientIds.includes(id)) {
      onRecipientsChange(recipientIds.filter((r) => r !== id));
    } else {
      onRecipientsChange([...recipientIds, id]);
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        Del med
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAudienceChange("all")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            audience === "all"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Alle i bedriften
        </button>
        <button
          type="button"
          onClick={() => onAudienceChange("selected")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            audience === "selected"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Bestemte brukere
        </button>
      </div>

      {audience === "selected" && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-1">
          {selectable.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-400">
              Ingen andre brukere å dele med ennå.
            </p>
          ) : (
            selectable.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={recipientIds.includes(u.id)}
                  onChange={() => toggle(u.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{u.full_name ?? "Uten navn"}</span>
              </label>
            ))
          )}
          {audience === "selected" && recipientIds.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-amber-600">
              Velg minst én bruker – ellers er det bare du (og bedriftsadmin) som
              ser den.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
