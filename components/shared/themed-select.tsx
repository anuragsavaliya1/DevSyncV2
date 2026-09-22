/** Themed listbox select — replaces native <select> option menus for DevSync styling. */
"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type ThemedSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type ThemedSelectProps = {
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  placeholder?: string;
};

type MenuPosition = { top: number; left: number; width: number };

export function ThemedSelect({
  value,
  options,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  className = "",
  placeholder = "Select…",
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const hasDescriptions = options.some(option =>
        Boolean(option.description)
      );
      const width = hasDescriptions ? 210 : Math.max(rect.width, 120);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const estimatedHeight = Math.min(
        options.length * (hasDescriptions ? 54 : 40) + 8,
        280
      );
      const openUp =
        rect.bottom + estimatedHeight > window.innerHeight - 8 &&
        rect.top > estimatedHeight;
      setMenuPosition({
        top: openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6,
        left: Math.max(8, left),
        width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const menu =
    open && mounted && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="ds-listbox fixed z-[120] max-h-64 overflow-y-auto py-1"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
          >
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 text-left transition ${
                    isSelected
                      ? "bg-[#eaf7f4] text-[#0a7267]"
                      : "text-[#294354] hover:bg-[#f2f8f6]"
                  }`}
                >
                  <span className="block text-xs font-bold leading-4">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block text-[10px] font-medium leading-4 text-[#8294A0] whitespace-normal">
                      {option.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(current => !current)}
        className="ds-listbox-trigger flex w-full min-w-[8.5rem] items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold text-[#102a3a] outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={`truncate ${selected ? "text-[#102a3a]" : "text-[#8fa0ad]"}`}
        >
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#718494] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}
