---
name: High-Velocity Systems
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#c7c5ce'
  on-secondary: '#303037'
  secondary-container: '#4b4b52'
  on-secondary-container: '#bcbbc3'
  tertiary: '#95d3ba'
  on-tertiary: '#003829'
  tertiary-container: '#71af97'
  on-tertiary-container: '#004231'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#e3e1ea'
  secondary-fixed-dim: '#c7c5ce'
  on-secondary-fixed: '#1b1b21'
  on-secondary-fixed-variant: '#46464d'
  tertiary-fixed: '#b0f0d6'
  tertiary-fixed-dim: '#95d3ba'
  on-tertiary-fixed: '#002117'
  on-tertiary-fixed-variant: '#0b513d'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin: 24px
---

## Brand & Style

This design system is engineered for high-performance monitoring and technical oversight. It targets site reliability engineers, data analysts, and system architects who require immediate visual clarity in high-density information environments. 

The aesthetic is **High-Contrast Technical Minimalism**. By utilizing a "Void" background—a pitch-black canvas—the UI eliminates peripheral distractions, allowing vibrant data-driven accents to guide the user's eye. The style borrows from **Glassmorphism** for its layering logic (using translucent strokes and subtle blurs) and **Corporate Modern** for its structural reliability. The emotional response is one of absolute control, precision, and futuristic efficiency.

## Colors

The palette is anchored by a true black background (#000000) to maximize contrast and reduce power consumption on OLED displays. 

- **Primary (Vibrant Emerald):** Used exclusively for critical actions, active states, and successful status indicators. It is the "source of truth" in the UI.
- **Secondary (Zinc 700):** Provides structural support for inactive elements, borders, and secondary metadata.
- **Surface Tiers:** We use a "Darker Zinc" scale. The base surface is #09090b, with elevated containers using #18181b to create a sense of depth without relying on traditional drop shadows.
- **Semantic Accents:** While Emerald is the primary, use subtle variations for depth (e.g., #064e3b for low-priority backgrounds).

## Typography

The typography system prioritizes legibility and technical precision. We use **Geist** for its clean, geometric grotesque qualities that maintain clarity even at small sizes. 

**JetBrains Mono** is utilized for labels, status codes, and data points, reinforcing the system's "developer-first" DNA. Headers should use tight letter spacing to appear authoritative and compact. Body text maintains a generous line height for long-form log reading or documentation.

## Layout & Spacing

This design system employs a **Fixed Grid** model for primary dashboards to ensure telemetry data remains in a predictable location. On smaller viewports, it transitions to a **Fluid Grid**.

- **Grid:** 12-column layout for desktop (1440px max-width).
- **Rhythm:** A 4px baseline grid ensures tight, data-dense layouts. Use 16px (md) for most component spacing and 8px (sm) for internal element grouping.
- **Density:** High. Margins are kept tight (24px) to maximize the "real estate" for charts and tables.

## Elevation & Depth

In a pitch-black environment, shadows are physically illogical. Instead, we use **Tonal Layering** and **Stroke-based Depth**:

- **Level 0 (Floor):** #000000.
- **Level 1 (Card/Container):** #09090b with a 1px solid border of #27272a.
- **Level 2 (Popovers/Modals):** #18181b with a 1px solid border of #3f3f46 and a 20px backdrop blur on the layer beneath.
- **Active State:** Elements may emit a subtle Emerald outer glow (5-10px blur, 20% opacity) to signify focus or critical attention.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a professional, "tooled" look that feels engineered rather than organic.

- **Buttons & Inputs:** 4px (0.25rem) corner radius.
- **Large Containers:** 8px (0.5rem) corner radius.
- **Indicators:** Circular (pill) shapes are reserved exclusively for status pips and toggle switches to differentiate them from interactive buttons.

## Components

- **Buttons:** Primary buttons use a solid Emerald (#10b981) fill with black text for maximum contrast. Secondary buttons use a ghost style with a Zinc-700 border and white text.
- **Status Chips:** Small, monospaced text within a low-opacity Emerald background (e.g., 10% opacity) for "Healthy" states. Use "Emerald Pips" (small circles) next to text for live connectivity indicators.
- **Input Fields:** Darker Zinc (#09090b) background with a 1px Zinc-800 border. On focus, the border transitions to Emerald.
- **Data Tables:** No vertical borders. Use 1px horizontal dividers (#18181b). Row hover states should use a subtle #09090b highlight.
- **Cards:** No shadows. Use 1px borders (#27272a). Titles should be in JetBrains Mono, all-caps, at 12px for a "dashboard" feel.
- **Charts:** Use Emerald for primary data lines. Use secondary Zinc for grid lines. Avoid multiple colors; use opacity of Emerald to represent different data sets where possible.