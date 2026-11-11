"use client";

import { AdminShell } from "@/components/AdminShell";
import { MusicManager } from "@/components/MusicManager";
import { TimingSettings } from "@/components/TimingSettings";

/** Admin settings: slideshow options and the slideshow music. */
export default function AdminSettingsPage() {
  return (
    <AdminShell active="/admin/settings">
      {() => (
        <>
          <TimingSettings />
          <MusicManager />
        </>
      )}
    </AdminShell>
  );
}
