---
name: ui-ux-pro-max
description: >-
  Enforces modern, high-polish UI/UX standards, design system rules, spacing,
  typography, micro-interactions, responsive layouts, and accessible components
  for WorkMesh AI frontend (React + Tailwind CSS).
---

# WorkMesh AI — UI/UX Pro Max Design System

This skill enforces enterprise-grade aesthetic and interaction standards for all frontend React + Tailwind components in WorkMesh AI.

---

## 1. Visual Hierarchy & Color System

- **Neutrals (Surfaces & Typography):**
  - Backgrounds: `bg-slate-50` (page canvas), `bg-white` (cards, tables, modals).
  - Borders & Dividers: `border-slate-200` (subtle structural separation).
  - Text:
    - Headings: `text-slate-900 font-bold tracking-tight`
    - Body / Primary: `text-slate-700 font-medium`
    - Subtext / Metadata: `text-slate-500 text-xs`
    - Code / Monospace: `font-mono text-xs text-slate-600`

- **Primary Accent (WorkMesh Indigo/Violet):**
  - Default: `bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs`
  - Subtle / Badges: `bg-indigo-50 text-indigo-700 border border-indigo-200`
  - Focus Ring: `focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`

- **Semantic Statuses (Always paired with visual indicators):**
  - **Success / Ready:** `bg-emerald-50 text-emerald-700 border-emerald-200` (with solid emerald dot)
  - **In Progress / Processing:** `bg-indigo-50 text-indigo-700 border-indigo-200` (with pulsing dot)
  - **Warning / Pending:** `bg-amber-50 text-amber-700 border-amber-200` (with amber dot)
  - **Destructive / Failed:** `bg-rose-50 text-rose-700 border-rose-200` (with rose dot)

---

## 2. Component Design Standards

### Buttons
- **Primary:** `px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`
- **Secondary / Outline:** `px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer`
- **Destructive:** `px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md text-xs font-medium transition-colors cursor-pointer`

### Data Tables & Lists
- Wrap in `bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden`.
- Table headers: `bg-slate-50/75 px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200`.
- Rows: `divide-y divide-slate-100 hover:bg-slate-50/60 transition-colors`.
- Align numeric and action columns to the right (`text-right`).

### Modals & Dialogs
- Backdrop: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs`.
- Container: `w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150`.
- Modal header must have a clear title, subtitle, and close (`✕`) button.

### Form Inputs
- Standard: `px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow`.
- Labels: `block text-sm font-semibold text-slate-700 mb-1`.

---

## 3. Micro-Interactions & State Polish

1. **Loading States:** Never leave the screen blank during fetches. Show a sleek spinner with friendly copy (e.g. `Loading documents...`) or pulsing skeletons.
2. **Empty States:** When a list is empty or filters return zero items, display a helpful illustration or icon, friendly description, and a clear primary Call-to-Action button.
3. **Optimistic Feedback:** Show instant success toast/alert banners that auto-dismiss after 4–5 seconds.
4. **Tooltips & Truncation:** Truncate long IDs or hashes with ellipsis (`truncate`) and display full text on hover with `title`.
