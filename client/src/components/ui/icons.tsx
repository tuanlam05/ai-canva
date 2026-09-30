import type { SVGProps } from "react";

/**
 * Small 24px-grid stroke icons (Lucide shapes) used by the canvas chrome in
 * place of emoji. Size comes from the caller's className / width+height.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 14, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = ({ size = 12, ...p }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden {...p}>
    <path d="M7 4.5v15l12.5-7.5z" />
  </svg>
);

export const RerunIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);

export const CaretIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg size={12} strokeWidth={2.4} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg size={16} strokeWidth={1.8} {...p}>
    <path d="M12 15V4M7 9l5-5 5 5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg size={12} {...p}>
    <path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg size={16} strokeWidth={2.4} {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </Svg>
);

export const HistoryIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg size={12} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const FileIcon = (p: IconProps) => (
  <Svg size={14} strokeWidth={1.8} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg size={12} {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
  </Svg>
);

export const LogoutIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg size={12} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const ListIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Svg>
);

export const NoteIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <path d="M5 3h14v12l-6 6H5z" />
    <path d="M13 21v-6h6" />
  </Svg>
);

export const TagIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <path d="M7.5 7.5h.01" />
  </Svg>
);

export const SquareIcon = (p: IconProps) => (
  <Svg size={12} {...p}>
    <rect x="4" y="6" width="16" height="12" rx="2" strokeDasharray="3 2.5" />
  </Svg>
);

export function Spinner({ size = 12 }: { size?: number }) {
  return (
    <Svg size={size} className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </Svg>
  );
}

export const SunIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
  </Svg>
);

export const MonitorIcon = (p: IconProps) => (
  <Svg size={14} {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg size={13} {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
);

/**
 * Box-type icons for the header tile and the Add Box panel. Drawn for what
 * each step does (not generic app glyphs), 24px grid, 1.75 stroke:
 *   Insight Weaver = separate quotes (dots) woven into one theme
 *   Journey Mapper = emotion line with a point per stage (its chart)
 *   Patient Safety Reviewer = clipboard with a medical cross (clinical review)
 *   UX Coach = speech bubble with a next-step arrow (advice)
 *   PDF Summary = report page with summary lines
 *   Text Context = quotation marks (verbatim transcript)
 *   Documents = paperclip (attached files)
 *   Note / Label / Checklist = sticky note / tag / ticked list
 */
export function BoxIcon({ type, size = 16 }: { type: string; size?: number }) {
  const common = { size, strokeWidth: 1.75 };
  switch (type) {
    case "insight":
      return (
        <Svg {...common}>
          <circle cx="4" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
          <path d="M6.5 5.5c5 0 6 6.5 10 6.5M6.5 18.5c5 0 6-6.5 10-6.5M6.5 12h10" />
          <circle cx="19" cy="12" r="2.5" />
        </Svg>
      );
    case "journey":
      return (
        <Svg {...common}>
          <path d="M3 20.5h18" />
          <path d="M4.5 12 9 7l5 7 5.5-8" />
          <circle cx="4.5" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="9" cy="7" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="14" cy="14" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="19.5" cy="6" r="1.7" fill="currentColor" stroke="none" />
        </Svg>
      );
    case "safety":
      return (
        <Svg {...common}>
          <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
          <path d="M9.5 3h5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M12 10.5v6M9 13.5h6" />
        </Svg>
      );
    case "coach":
      return (
        <Svg {...common}>
          <path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-7.5L7 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z" />
          <path d="M8 10.5h7M12.5 8l2.5 2.5-2.5 2.5" />
        </Svg>
      );
    case "summary":
      return (
        <Svg {...common}>
          <path d="M6.5 3h8l4 4v12.5A1.5 1.5 0 0 1 17 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z" />
          <path d="M14.5 3v4h4M8.5 11h7M8.5 14h7M8.5 17h4" />
        </Svg>
      );
    case "text":
      return (
        <Svg {...common}>
          <path d="M4.5 6.5h5v5c0 3.2-1.6 5.3-4.5 6" />
          <path d="M4.5 6.5v5h5" />
          <path d="M14.5 6.5h5v5c0 3.2-1.6 5.3-4.5 6" />
          <path d="M14.5 6.5v5h5" />
        </Svg>
      );
    case "documents":
      return (
        <Svg {...common}>
          <path d="M19.5 11.5 12 19a4.6 4.6 0 0 1-6.5-6.5l8-8a3.1 3.1 0 0 1 4.4 4.4l-7.9 7.9a1.6 1.6 0 0 1-2.3-2.3l7.3-7.3" />
        </Svg>
      );
    case "note":
      return (
        <Svg {...common}>
          <path d="M16 3.5H5A1.5 1.5 0 0 0 3.5 5v14A1.5 1.5 0 0 0 5 20.5h9l6.5-6.5V5A1.5 1.5 0 0 0 19 3.5z" />
          <path d="M14 20.5V16a2 2 0 0 1 2-2h4.5" />
        </Svg>
      );
    case "label":
      return (
        <Svg {...common}>
          <path d="M3.5 4.5v6.3a1.5 1.5 0 0 0 .44 1.06l8.2 8.2a1.5 1.5 0 0 0 2.12 0l6.3-6.3a1.5 1.5 0 0 0 0-2.12l-8.2-8.2A1.5 1.5 0 0 0 11.3 3H5a1.5 1.5 0 0 0-1.5 1.5z" />
          <circle cx="8" cy="8" r="1.2" />
        </Svg>
      );
    case "checklist":
      return (
        <Svg {...common}>
          <path d="m3.5 7 1.7 1.7L8.5 5.5M3.5 16.5l1.7 1.7 3.3-3.2M12 7h8.5M12 17h8.5" />
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </Svg>
      );
  }
}
