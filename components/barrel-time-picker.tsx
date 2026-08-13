"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { formatBarrelTime, parseBarrelTime, type TimeParts } from "@/lib/barrel-time";

export { formatBarrelTime, parseBarrelTime } from "@/lib/barrel-time";

type WheelColumnProps = {
  label: string;
  items: string[];
  selected: string;
  onSelect: (value: string) => void;
};

function WheelColumn({ label, items, selected, onSelect }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const dragRef = useRef<Draggable | null>(null);
  const settleTimer = useRef<number | null>(null);
  const itemHeight = 36;
  const centerOffset = 24;

  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  useEffect(() => {
    gsap.registerPlugin(Draggable);
    const container = containerRef.current;
    const column = columnRef.current;
    if (!container || !column) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initialIndex = Math.max(0, items.indexOf(selectedRef.current));
    const minY = centerOffset - (items.length - 1) * itemHeight;
    const maxY = centerOffset;

    function updateStyles() {
      const y = Number(gsap.getProperty(column!, "y"));
      [...column!.children].forEach((child, index) => {
        const ratio = (index * itemHeight + y - centerOffset) / itemHeight;
        const distance = Math.abs(ratio);
        gsap.set(child, {
          rotateX: Math.max(-50, Math.min(50, ratio * -30)),
          translateZ: -distance * 12,
          scale: Math.max(.85, 1 - distance * .12),
          opacity: Math.max(.3, 1 - distance * .55),
          color: distance < .35 ? "#141513" : "#9ca3af",
          transformOrigin: "center center -10px",
        });
      });
    }

    function snapTo(index: number, momentum = 0) {
      const y = Number(gsap.getProperty(column!, "y"));
      const target = Number.isFinite(index) ? index : Math.round((centerOffset - (y + momentum)) / itemHeight);
      const targetIndex = Math.max(0, Math.min(items.length - 1, target));
      gsap.to(column!, {
        y: centerOffset - targetIndex * itemHeight,
        duration: reducedMotion ? 0 : .25,
        ease: "power2.out",
        onUpdate: updateStyles,
        onComplete: () => {
          updateStyles();
          if (items[targetIndex] !== selectedRef.current) onSelectRef.current(items[targetIndex]);
        },
      });
    }

    gsap.set(column, { y: centerOffset - initialIndex * itemHeight });
    updateStyles();
    dragRef.current = Draggable.create(column, {
      type: "y",
      edgeResistance: .88,
      bounds: { minY, maxY },
      onDragStart: () => gsap.killTweensOf(column),
      onDrag: updateStyles,
      onDragEnd(this: Draggable) {
        snapTo(Number.NaN, (this.endY - this.y) * .4);
      },
    })[0];

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      gsap.killTweensOf(column);
      let delta = event.deltaY;
      if (Math.abs(delta) > 40) delta = Math.sign(delta) * 18;
      const y = Number(gsap.getProperty(column, "y"));
      const nextY = Math.max(minY - 12, Math.min(maxY + 12, y - delta * .9));
      gsap.set(column, { y: nextY });
      updateStyles();
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => snapTo(Number.NaN, -delta * .8), 100);
    };
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      dragRef.current?.kill();
      dragRef.current = null;
      gsap.killTweensOf(column);
    };
  }, [items]);

  useEffect(() => {
    const column = columnRef.current;
    if (!column || dragRef.current?.isDragging) return;
    const index = items.indexOf(selected);
    if (index < 0) return;
    gsap.to(column, { y: centerOffset - index * itemHeight, duration: .2, ease: "power2.out" });
  }, [items, selected]);

  function step(direction: number) {
    const index = Math.max(0, items.indexOf(selected));
    const next = Math.max(0, Math.min(items.length - 1, index + direction));
    if (next !== index) onSelect(items[next]);
  }

  return <div className="barrel-wheel__column">
    <button type="button" tabIndex={-1} aria-label={`Previous ${label}`} onClick={() => step(-1)}><ChevronUp size={15} aria-hidden="true" /></button>
    <div ref={containerRef} className="barrel-wheel__viewport">
      <div className="barrel-wheel__selection" aria-hidden="true" />
      <div
        ref={columnRef}
        className="barrel-wheel__items"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={selected}
        aria-valuemin={0}
        aria-valuemax={items.length - 1}
        aria-valuenow={Math.max(0, items.indexOf(selected))}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            step(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
      >{items.map((item) => <div className="barrel-wheel__item" key={item} aria-hidden="true">{item}</div>)}</div>
    </div>
    <button type="button" tabIndex={-1} aria-label={`Next ${label}`} onClick={() => step(1)}><ChevronDown size={15} aria-hidden="true" /></button>
  </div>;
}

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const periods = ["AM", "PM"];

export function BarrelTimePicker({ value, onChange, label = "Choose time" }: { value: string; onChange: (value: string) => void; label?: string }) {
  const id = useId();
  const parsed = parseBarrelTime(value || "09:00");
  const update = (part: Partial<TimeParts>) => onChange(formatBarrelTime(part.hour ?? parsed.hour, part.minute ?? parsed.minute, part.period ?? parsed.period));
  return <div className="barrel-wheel" role="group" aria-labelledby={id}>
    <span id={id} className="sr-only">{label}</span>
    <WheelColumn label="Hour" items={hours} selected={String(parsed.hour)} onSelect={(hour) => update({ hour: Number(hour) })} />
    <WheelColumn label="Minute" items={minutes} selected={String(parsed.minute).padStart(2, "0")} onSelect={(minute) => update({ minute: Number(minute) })} />
    <WheelColumn label="AM or PM" items={periods} selected={parsed.period} onSelect={(period) => update({ period: period as "AM" | "PM" })} />
  </div>;
}
