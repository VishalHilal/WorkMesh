# Design System

<!-- impeccable:design-schema 1 -->

## Design Stance

- **Mode:** Operate (enterprise productivity dashboard and administrative control).
- **Aesthetic Direction:** Authoritative, high-density, crisp enterprise tool (Linear/Stripe-tier). Clean neutral canvas, deliberate typography, and zero decorative fluff.
- **Banned Clichés (Strictly Enforced):**
  - No emoji as icons (all icons are custom authored SVGs with 1.5px consistent stroke).
  - No eyebrows or kickers floating above headings.
  - No decorative gradients or blurry backdrop halos.
  - No ghost elevation (border + shadow collision). Use crisp 1px borders.
  - No trailing arrows (`→`) appended to link labels.

## Palette

- **Canvas Background:** `#F8FAFC` (`bg-slate-50`)
- **Card & Surface Background:** `#FFFFFF` (`bg-white`)
- **Subtle Borders:** `#E2E8F0` (`border-slate-200`)
- **Deep Contrast Typography:** `#0F172A` (`text-slate-900`)
- **Secondary Body Text:** `#475569` (`text-slate-600`)
- **Muted Metadata:** `#64748B` (`text-slate-500`)
- **Brand Primary Accent:** `#4F46E5` (`bg-indigo-600` / `#4338CA` hover)
- **Semantic Badges:**
  - Ready / Active: Emerald (`#059669` / `#ECFDF5`)
  - Processing: Indigo (`#4F46E5` / `#EEF2FF`)
  - Pending: Amber (`#D97706` / `#FFFBEB`)
  - Failed / Danger: Rose (`#E11D48` / `#FFF1F2`)

## Typography

- **Display & Headings:** Sans-serif, tracking `-0.025em`, font weights `700` and `600`, sentence case.
- **Body & Controls:** Font weight `500` and `400`, line-height `1.5`, measure `<75ch`.
- **Data & Numbers:** `font-mono tabular-nums text-xs` for file sizes, dates, and identifiers.

## Components & Iconography

- **Icons:** Authored SVG icons, 16×16px or 20×20px, `stroke-width="1.5"`, `stroke="currentColor"`.
- **Tables:** Compact data rows, clear borders, hover state `hover:bg-slate-50/70`, right-aligned numeric actions.
- **Forms:** Focus ring `ring-2 ring-indigo-500 ring-offset-1`, clean 1px border.
