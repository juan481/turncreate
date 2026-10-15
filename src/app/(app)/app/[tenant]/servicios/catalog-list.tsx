"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { saveCatalogOrder, setServiceFeatured } from "./actions";

export type CatalogService = {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
  public: boolean;
  featured: boolean;
};

export type CatalogGroup = {
  id: string;
  name: string;
  /** Solo las categorías reales se arrastran; "Otros servicios" queda siempre al final. */
  isCategory: boolean;
  services: CatalogService[];
};

const CAT = "cat:";
const SVC = "svc:";

// Solo se mueve en vertical: en mobile un arrastre con algo de diagonal
// no debería "sacar" la tarjeta de la columna.
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// Una categoría solo puede caer sobre otra categoría, y un servicio solo
// sobre servicios de su misma categoría -- así arrastrar nunca cambia la
// categoría de un servicio por accidente (eso se hace desde Editar).
function isValidTarget(activeId: string, activeGroup: unknown, targetId: string, targetGroup: unknown) {
  if (activeId.startsWith(CAT)) return targetId.startsWith(CAT);
  return targetId.startsWith(SVC) && targetGroup === activeGroup;
}

const collisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  const activeGroup = args.active.data.current?.groupId;
  const droppableContainers = args.droppableContainers.filter((container) =>
    isValidTarget(activeId, activeGroup, String(container.id), container.data.current?.groupId),
  );
  return closestCenter({ ...args, droppableContainers });
};

// Con teclado (espacio para agarrar, flechas, espacio para soltar). El
// getter estándar de dnd-kit apuntaba a la sección de la categoría que
// contiene al servicio y el ítem "caía sobre sí mismo"; este salta solo al
// destino válido más cercano en la dirección de la flecha.
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { active, collisionRect, droppableRects, droppableContainers } = context;
  if (!active || !collisionRect || (event.code !== "ArrowUp" && event.code !== "ArrowDown")) return undefined;
  event.preventDefault();
  const activeId = String(active.id);
  const activeGroup = active.data.current?.groupId;
  const up = event.code === "ArrowUp";
  let target: { left: number; top: number } | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const container of droppableContainers.getEnabled()) {
    const id = String(container.id);
    if (id === activeId || !isValidTarget(activeId, activeGroup, id, container.data.current?.groupId)) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const delta = rect.top - collisionRect.top;
    if (up ? delta >= 0 : delta <= 0) continue;
    if (Math.abs(delta) < distance) {
      distance = Math.abs(delta);
      target = rect;
    }
  }
  return target ? { x: target.left, y: target.top } : undefined;
};

function DragHandle({ label, attributes, listeners }: { label: string; attributes: object; listeners: object | undefined }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-inner text-on-surface-variant hover:bg-surface-container-low active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <Icon name="drag_indicator" className="text-[18px]" />
    </button>
  );
}

function SortableService({
  tenantSlug,
  groupId,
  service,
  onToggleFeatured,
}: {
  tenantSlug: string;
  groupId: string;
  service: CatalogService;
  onToggleFeatured: (service: CatalogService) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${SVC}${service.id}`,
    data: { groupId },
  });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-inner border bg-surface-container-lowest py-1 pl-1 pr-1.5",
        service.featured ? "border-status-draft-dot/60 bg-status-draft-bg" : "border-border",
        isDragging && "relative z-10 shadow-card-hover ring-2 ring-primary/30",
      )}
    >
      <DragHandle label={`Mover ${service.name}`} attributes={attributes} listeners={listeners} />
      <Link href={`/app/${tenantSlug}/servicios/${service.id}`} className="min-w-0 flex-1 py-1.5">
        <p className="line-clamp-2 break-words font-label-lg text-label-lg leading-tight text-on-surface">{service.name}</p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-body-sm text-body-sm text-on-surface-variant">
          <span className="tabular-nums">{service.duration} min</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums text-on-surface">${service.price.toLocaleString("es-AR")}</span>
          {!service.active && <span className="rounded-pill bg-status-draft-bg px-2 font-label-xs text-label-xs text-status-draft">Pausado</span>}
          {service.active && !service.public && <span className="rounded-pill bg-surface-container px-2 font-label-xs text-label-xs">Solo interno</span>}
        </p>
      </Link>
      <button
        type="button"
        onClick={() => onToggleFeatured(service)}
        aria-pressed={service.featured}
        aria-label={service.featured ? `Quitar destacado de ${service.name}` : `Destacar ${service.name}`}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
          service.featured ? "text-status-draft-dot" : "text-on-surface-variant/60 hover:text-status-draft-dot",
        )}
      >
        <Icon name="star" filled={service.featured} className="text-[20px]" />
      </button>
    </li>
  );
}

function GroupShell({ group, handle, children, style, setNodeRef, isDragging }: {
  group: CatalogGroup;
  handle?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  isDragging?: boolean;
}) {
  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "space-y-2 rounded-card border border-border bg-surface p-2.5 shadow-card",
        isDragging && "relative z-20 shadow-card-hover ring-2 ring-primary/30",
      )}
      aria-label={group.name}
    >
      <div className="flex min-w-0 items-center gap-1 pr-2">
        {handle ?? <span className="w-1" />}
        <h2 className="min-w-0 flex-1 truncate font-headline-sm text-headline-sm text-on-surface">{group.name}</h2>
        <span className="shrink-0 rounded-pill bg-surface-container-low px-2.5 py-0.5 font-label-sm text-label-sm tabular-nums text-on-surface-variant">
          {group.services.length}
        </span>
      </div>
      {children}
    </section>
  );
}

function SortableCategory({ group, children }: { group: CatalogGroup; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `${CAT}${group.id}` });
  return (
    <GroupShell
      group={group}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      handle={<DragHandle label={`Mover la categoría ${group.name} con sus servicios`} attributes={attributes} listeners={listeners} />}
    >
      {children}
    </GroupShell>
  );
}

export function CatalogList({ tenantSlug, groups: initialGroups }: { tenantSlug: string; groups: CatalogGroup[] }) {
  const toast = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  // Solo se guarda lo que se movió (el orden de las categorías, o el de los
  // servicios de UNA categoría): mandar el catálogo entero hacía que, si
  // dos personas ordenaban a la vez, la última pisara lo de la otra.
  function persist(next: CatalogGroup[], previous: CatalogGroup[], order: { categoryIds: string[]; serviceIds: string[] }) {
    setGroups(next);
    startTransition(async () => {
      const result = await saveCatalogOrder(tenantSlug, order);
      if (result.error) {
        setGroups(previous);
        toast.show(result.error, "error");
        return;
      }
      toast.show("Orden guardado");
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith(CAT) && overId.startsWith(CAT)) {
      const categories = groups.filter((group) => group.isCategory);
      const others = groups.filter((group) => !group.isCategory);
      const from = categories.findIndex((group) => `${CAT}${group.id}` === activeId);
      const to = categories.findIndex((group) => `${CAT}${group.id}` === overId);
      if (from < 0 || to < 0) return;
      const reordered = arrayMove(categories, from, to);
      persist([...reordered, ...others], groups, { categoryIds: reordered.map((group) => group.id), serviceIds: [] });
      return;
    }

    if (activeId.startsWith(SVC) && overId.startsWith(SVC)) {
      const groupIndex = groups.findIndex((group) => group.services.some((service) => `${SVC}${service.id}` === activeId));
      if (groupIndex < 0) return;
      const services = groups[groupIndex].services;
      const from = services.findIndex((service) => `${SVC}${service.id}` === activeId);
      const to = services.findIndex((service) => `${SVC}${service.id}` === overId);
      if (from < 0 || to < 0) return;
      const reordered = arrayMove(services, from, to);
      const next = groups.map((group, index) => (index === groupIndex ? { ...group, services: reordered } : group));
      persist(next, groups, { categoryIds: [], serviceIds: reordered.map((service) => service.id) });
    }
  }

  function toggleFeatured(service: CatalogService) {
    const previous = groups;
    const featured = !service.featured;
    setGroups(groups.map((group) => ({
      ...group,
      services: group.services.map((item) => (item.id === service.id ? { ...item, featured } : item)),
    })));
    startTransition(async () => {
      const result = await setServiceFeatured(tenantSlug, service.id, featured);
      if (result.error) {
        setGroups(previous);
        toast.show(result.error, "error");
        return;
      }
      toast.show(featured ? `"${service.name}" destacado` : "Quitamos el destacado");
    });
  }

  const renderServices = (group: CatalogGroup) => (
    <SortableContext items={group.services.map((service) => `${SVC}${service.id}`)} strategy={verticalListSortingStrategy}>
      <ul className="space-y-1.5">
        {group.services.map((service) => (
          <SortableService key={service.id} tenantSlug={tenantSlug} groupId={group.id} service={service} onToggleFeatured={toggleFeatured} />
        ))}
      </ul>
    </SortableContext>
  );

  const categoryGroups = groups.filter((group) => group.isCategory);
  const otherGroups = groups.filter((group) => !group.isCategory);

  return (
    <DndContext id="catalog-dnd" sensors={sensors} collisionDetection={collisionDetection} modifiers={[verticalOnly]} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <SortableContext items={categoryGroups.map((group) => `${CAT}${group.id}`)} strategy={verticalListSortingStrategy}>
          {categoryGroups.map((group) => (
            <SortableCategory key={group.id} group={group}>
              {group.services.length > 0 ? renderServices(group) : (
                <p className="px-2 pb-1 font-body-sm text-body-sm text-on-surface-variant">Todavía no tiene servicios.</p>
              )}
            </SortableCategory>
          ))}
        </SortableContext>
        {otherGroups.map((group) => (
          <GroupShell key={group.id} group={group}>
            {renderServices(group)}
          </GroupShell>
        ))}
      </div>
    </DndContext>
  );
}
