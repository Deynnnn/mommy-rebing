"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaType } from "@/lib/types";

export type AdminPost = {
  id: string;
  createdAt: string;
  name: string | null;
  message: string | null;
  hidden: boolean;
  mediaType: MediaType;
};

/**
 * Guest uploads in display order. Drag (mouse) or press-and-hold then drag (phone) to rearrange.
 * The new order is used by the gallery and the TV slideshow.
 */
export function GuestUploads({
  posts,
  onReorder,
  onToggle,
  onDragState,
}: {
  posts: AdminPost[];
  onReorder: (next: AdminPost[]) => void;
  onToggle: (p: AdminPost) => void;
  onDragState: (dragging: boolean) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    onDragState(false);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = posts.findIndex((p) => p.id === active.id);
    const to = posts.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(posts, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => onDragState(true)}
      onDragCancel={() => onDragState(false)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={posts.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {posts.map((p, i) => (
            <Card key={p.id} post={p} position={i + 1} onToggle={onToggle} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Card({ post: p, position, onToggle }: { post: AdminPost; position: number; onToggle: (p: AdminPost) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={`touch-manipulation select-none overflow-hidden rounded-lg border bg-paper ${
        p.hidden ? "border-red-300 opacity-50" : "border-line"
      } ${isDragging ? "scale-[1.03] shadow-xl ring-2 ring-gold" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="relative cursor-grab active:cursor-grabbing">
        {p.mediaType === "video" ? (
          <video
            src={`/api/image/${p.id}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none aspect-square w-full bg-black object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/image/${p.id}`}
            alt=""
            loading="lazy"
            draggable={false}
            className="pointer-events-none aspect-square w-full object-cover"
          />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          #{position}
        </span>
        {p.mediaType === "video" && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">▶ video</span>
        )}
        <span className="absolute right-1.5 top-1.5 rounded bg-black/50 px-1.5 text-sm leading-6 text-white" aria-hidden>
          ⠿
        </span>
      </div>
      <div className="space-y-1 p-2 text-xs">
        {p.message && <p className="line-clamp-3 font-serif text-sm">{p.message}</p>}
        <p className="text-muted">
          {p.name || "Guest"} · {new Date(p.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
        <button
          // keep taps on the button from starting a drag
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={() => onToggle(p)}
          className={`w-full rounded-md py-1.5 font-medium ${p.hidden ? "bg-ink text-cream" : "bg-red-50 text-red-700"}`}
        >
          {p.hidden ? "Show again" : "Hide"}
        </button>
      </div>
    </div>
  );
}
