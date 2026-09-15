import type { SVGProps } from "react";
import type { HomeCategoryId } from "@/domain/home/categories";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Svg fill="currentColor" stroke="none" {...props}>
      <path d="M12 2.8c.18 0 .32.12.37.3l1.45 4.85 5.05.42c.2.02.35.2.28.38-.06.16-.2.24-.36.3l-4.12 2.42 1.28 4.9c.05.2-.1.38-.3.42-.16.03-.33-.06-.42-.22L12 13.72 8.77 16.57c-.1.16-.26.25-.42.22-.2-.04-.35-.22-.3-.42l1.28-4.9-4.12-2.42c-.16-.06-.3-.14-.36-.3-.07-.18.08-.36.28-.38l5.05-.42L11.63 3.1c.05-.18.19-.3.37-.3Z" />
    </Svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" />
      <circle cx="12" cy="11" r="1.6" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.6" cy="7.4" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6 18 18M18 6 6 18" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 7.5 7.5 6 7.5-6" />
    </Svg>
  );
}

const categoryPaths: Record<HomeCategoryId, string> = {
  family:
    "M16 19v-1.2A2.8 2.8 0 0 0 13.2 15H6.8A2.8 2.8 0 0 0 4 17.8V19M10 12.2A3.1 3.1 0 1 0 10 6a3.1 3.1 0 0 0 0 6.2ZM20 19v-1.1A2.4 2.4 0 0 0 17.7 15.6M14.9 6.3a3.1 3.1 0 0 1 0 5.9",
  books: "M4.5 5.5h6.2A2.3 2.3 0 0 1 13 7.8V19a2 2 0 0 0-2-2H4.5V5.5Zm15 0h-6.2A2.3 2.3 0 0 0 11 7.8V19a2 2 0 0 1 2-2h6.5V5.5Z",
  games: "M7.5 9.5h9A3.5 3.5 0 0 1 20 13v2.2a3.3 3.3 0 0 1-3.3 3.3h-1.3l-1.2-1.5h-3.4L9.6 18.5H8.3A3.3 3.3 0 0 1 5 15.2V13a3.5 3.5 0 0 1 2.5-3.5ZM9 13v2m-1-1h2m6.2-.2h.01M15.4 12.4h.01",
  tech: "M9 3.5h6v3H9v-3Zm-4 6h14v11H5v-11Zm4 11v2.5m6-2.5v2.5M9.5 12.5h5",
  food: "M8 3.5v7M6.2 3.5v7M9.8 3.5v7M8 10.5v10M16 4.5c0 3-1.4 5.3-2.2 6.5V20.5h4.4v-9.5C17.4 9.8 16 7.5 16 4.5Z",
  ai: "M12 3.5 13.1 8 17.5 9.2 13.1 10.4 12 14.9 10.9 10.4 6.5 9.2 10.9 8 12 3.5Zm6.7 8.2 0.6 2.3 2.2.6-2.2.6-.6 2.3-.6-2.3-2.2-.6 2.2-.6.6-2.3ZM4.8 13.2l.5 1.8 1.8.5-1.8.5-.5 1.8-.5-1.8-1.8-.5 1.8-.5.5-1.8Z",
  running: "M14.2 6.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM8.2 21.2l2-6.2 2.4 2.2 1.6 4M10.2 15l2.6-3.4 3.1 1.4 2.7-2.2M12.8 11.6 10 9.4 8 11.2",
  arts: "M12 3.5A8.5 8.5 0 1 0 15.2 19c.6 0 1.2-.7 1.2-1.5 0-.5-.2-1 .1-1.4.3-.4.9-.5 1.4-.5A3.4 3.4 0 0 0 20.5 12 8.5 8.5 0 0 0 12 3.5ZM8 10.2h.01M10.2 7.4h.01M14.2 7.4h.01M16.4 10.2h.01",
  climate: "M12 20.5c-2.4 0-4.4-1.8-4.4-4.3 0-1.6.8-2.8 1.6-3.8.3-.4.6-.4.8 0 .5.8 1.2 1.5 1.2 2.4 0 0 1.1-2.3 2.8-4.5 1.3 2.4 2.4 4.6 2.4 6 0 2.4-1.9 4.2-4.4 4.2Z",
  fitness: "M7.2 9.2v5.6M16.8 9.2v5.6M5 10.6v2.8h2.2V10.6H5Zm11.8 0v2.8H19V10.6h-2.2ZM9.4 11.2h5.2v1.6H9.4v-1.6Z",
  wellness: "M12 19.7S5 14.4 5 9.8A3.8 3.8 0 0 1 12 7.4 3.8 3.8 0 0 1 19 9.8c0 4.6-7 9.9-7 9.9Z",
  crypto: "M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5Zm0 4.2v8.6m0-8.6 5.4 3.1M12 7.7 6.6 10.8",
};

export function CategoryIcon({ id, ...props }: IconProps & { id: HomeCategoryId }) {
  return (
    <Svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d={categoryPaths[id]} />
    </Svg>
  );
}
