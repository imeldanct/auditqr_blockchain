/**
 * AuditQR UNIFIED DESIGN SYSTEM
 * 
 * Core Palette:
 * - Black/Charcoals: Structure, backgrounds, neutral elements
 * - Blue (#3185FC): Primary actions, interactive elements, call-to-action
 * - Tea Green (#D6FFB7): Success states, verification, blockchain confirmations
 * - Red (#FF6B6B): Errors and critical actions
 * - Orange (#FFAA00): Warnings and cautions
 * 
 * This file should be used as the source of truth for all design tokens
 */

module.exports = {
  // TAILWIND CONFIG EXTENSION
  tailwindConfig: {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          // PRIMARY PALETTE (New Unified)
          "primary": "#3185FC",           // Blue - Primary actions
          "primary-light": "#4A9AFF",     // Blue lighter
          "primary-dark": "#1E4D99",      // Blue darker
          
          "success": "#D6FFB7",           // Tea Green - Verification states
          "success-light": "#E8FFCC",     // Tea Green lighter
          "success-dark": "#A8D47A",      // Tea Green darker
          
          "error": "#FF6B6B",             // Red - Errors
          "error-light": "#FF9999",       // Red lighter
          "error-dark": "#CC3333",        // Red darker
          
          "warning": "#FFAA00",           // Orange - Warnings
          "warning-light": "#FFB733",     // Orange lighter
          "warning-dark": "#CC8800",      // Orange darker
          
          // NEUTRALS (Charcoal/Black system)
          "bg": "#080708",                // Darkest background
          "surface": "#10131a",           // Primary surface
          "surface-2": "#1A1A1A",         // Secondary surface
          "surface-elevated": "#272a31",  // Elevated surface (cards, modals)
          "surface-light": "#32353c",     // Light surface
          
          "text-primary": "#E0E2EC",      // Primary text
          "text-secondary": "#C1C6D6",    // Secondary text
          "text-tertiary": "#8B909F",     // Tertiary text
          "text-muted": "#77867F",        // Muted text
          
          "border": "rgba(119,134,127,0.15)",     // Border color
          "border-light": "rgba(119,134,127,0.25)", // Light border
          
          // REMOVED: "cyan" palette entirely (no more #048A81)
          
          // STATUS COLORS
          "pending": "#FFAA00",           // Use warning
          "active": "#3185FC",            // Use primary
          "inactive": "#77867F",          // Use muted
          
          // SEMANTIC ALIASES (optional, for clarity)
          "action": "#3185FC",            // Primary action button
          "verified": "#D6FFB7",          // Verified/confirmed state
          "alert": "#FF6B6B",             // Alert/error state
        },
        
        fontFamily: {
          headline: ["Noto Serif", "serif"],
          display: ["Noto Serif", "serif"],
          body: ["Space Grotesk", "sans-serif"],
          label: ["Space Grotesk", "sans-serif"],
          mono: ["JetBrains Mono", "monospace"],
        },
        
        fontSize: {
          // Heading hierarchy
          "display-large": ["48px", { lineHeight: "1.2", fontWeight: "500" }],
          "display-medium": ["40px", { lineHeight: "1.2", fontWeight: "500" }],
          "heading-large": ["32px", { lineHeight: "1.3", fontWeight: "500" }],
          "heading-medium": ["28px", { lineHeight: "1.3", fontWeight: "500" }],
          "heading-small": ["24px", { lineHeight: "1.4", fontWeight: "500" }],
          
          // Body text
          "body-large": ["18px", { lineHeight: "1.7", fontWeight: "400" }],
          "body-medium": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
          "body-small": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
          
          // Labels
          "label-large": ["14px", { lineHeight: "1.5", fontWeight: "500" }],
          "label-medium": ["12px", { lineHeight: "1.4", fontWeight: "500" }],
          "label-small": ["11px", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "0.1em" }],
        },
        
        borderRadius: {
          "none": "0",
          "xs": "2px",
          "sm": "4px",
          "DEFAULT": "6px",
          "md": "8px",
          "lg": "12px",
          "xl": "16px",
          "2xl": "20px",
          "full": "9999px",
        },
        
        boxShadow: {
          "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          "DEFAULT": "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        },
        
        spacing: {
          "0": "0px",
          "1": "4px",
          "2": "8px",
          "3": "12px",
          "4": "16px",
          "5": "20px",
          "6": "24px",
          "7": "28px",
          "8": "32px",
          "10": "40px",
          "12": "48px",
          "16": "64px",
        },
      },
    },
  },

  // COMPONENT PATTERNS
  components: {
    // PRIMARY BUTTON
    "btn-primary": {
      base: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200",
      background: "bg-primary hover:bg-primary-dark active:brightness-90",
      text: "text-white",
      states: "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg",
      fullClass: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200 bg-primary hover:bg-primary-dark active:brightness-90 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg",
    },

    // SECONDARY BUTTON (outlined)
    "btn-secondary": {
      base: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200",
      background: "bg-transparent border-2 border-primary hover:bg-primary/10",
      text: "text-primary",
      states: "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary",
      fullClass: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200 bg-transparent border-2 border-primary hover:bg-primary/10 text-primary disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary",
    },

    // SUCCESS BUTTON (tea green)
    "btn-success": {
      base: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200",
      background: "bg-success hover:bg-success-dark",
      text: "text-surface",
      states: "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-success",
      fullClass: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200 bg-success hover:bg-success-dark text-surface disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-success",
    },

    // DANGER BUTTON (red)
    "btn-danger": {
      base: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200",
      background: "bg-error hover:bg-error-dark",
      text: "text-white",
      states: "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-error",
      fullClass: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200 bg-error hover:bg-error-dark text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-error",
    },

    // GHOST BUTTON (minimal)
    "btn-ghost": {
      base: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200",
      background: "bg-transparent hover:bg-surface-2",
      text: "text-text-primary",
      states: "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary",
      fullClass: "px-6 py-3 rounded-md font-label-medium text-center transition-all duration-200 bg-transparent hover:bg-surface-2 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary",
    },

    // INPUT FIELD
    "input-base": {
      base: "w-full px-4 py-3 rounded-md font-body-medium transition-all duration-200",
      background: "bg-surface-2 border border-border focus:border-primary focus:bg-surface-elevated",
      text: "text-text-primary placeholder-text-muted",
      states: "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none",
      fullClass: "w-full px-4 py-3 rounded-md font-body-medium transition-all duration-200 bg-surface-2 border border-border focus:border-primary focus:bg-surface-elevated text-text-primary placeholder-text-muted disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none",
    },

    // CARD CONTAINER
    "card": {
      base: "rounded-lg p-6 transition-all duration-200",
      background: "bg-surface-elevated border border-border",
      text: "text-text-primary",
      hover: "hover:shadow-md hover:border-border-light",
      fullClass: "rounded-lg p-6 transition-all duration-200 bg-surface-elevated border border-border text-text-primary hover:shadow-md hover:border-border-light",
    },

    // BADGE SUCCESS
    "badge-success": {
      base: "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-small",
      background: "bg-success/15 border border-success/30",
      text: "text-success",
      fullClass: "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-small bg-success/15 border border-success/30 text-success",
    },

    // BADGE ERROR
    "badge-error": {
      base: "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-small",
      background: "bg-error/15 border border-error/30",
      text: "text-error",
      fullClass: "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-small bg-error/15 border border-error/30 text-error",
    },

    // BADGE WARNING
    "badge-warning": {
      base: "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-small",
      background: "bg-warning/15 border border-warning/30",
      text: "text-warning",
      fullClass: "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-small bg-warning/15 border border-warning/30 text-warning",
    },

    // HEADER/TOP BAR
    "header": {
      base: "w-full h-16 flex items-center justify-between px-6 sticky top-0 z-50",
      background: "bg-bg border-b border-border",
      fullClass: "w-full h-16 flex items-center justify-between px-6 sticky top-0 z-50 bg-bg border-b border-border",
    },

    // SIDEBAR
    "sidebar": {
      base: "flex flex-col fixed h-full z-50 w-64",
      background: "bg-bg border-r border-border",
      fullClass: "flex flex-col fixed h-full z-50 w-64 bg-bg border-r border-border",
    },
  },

  // SPACING SYSTEM
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },

  // Z-INDEX SCALE
  zIndex: {
    "dropdown": 100,
    "sticky": 200,
    "fixed": 300,
    "modal-backdrop": 400,
    "modal": 500,
    "tooltip": 600,
    "notification": 700,
  },

  // SHADOWS
  shadows: {
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    "inner": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
  },

  // TRANSITIONS
  transitions: {
    "fast": "150ms ease-in-out",
    "base": "250ms ease-in-out",
    "slow": "350ms ease-in-out",
  },
};

/**
 * USAGE IN HTML:
 * 
 * 1. Primary Button:
 *    <button class="px-6 py-3 rounded-md font-label-medium bg-primary hover:bg-primary-dark text-white transition-all">
 *      Action
 *    </button>
 * 
 * 2. Success State:
 *    <div class="bg-success/15 border border-success/30 text-success rounded-lg p-4">
 *      ✓ Operation successful
 *    </div>
 * 
 * 3. Input Field:
 *    <input class="w-full px-4 py-3 rounded-md bg-surface-2 border border-border focus:border-primary text-text-primary">
 * 
 * 4. Card:
 *    <div class="rounded-lg p-6 bg-surface-elevated border border-border">
 *      Content
 *    </div>
 */
