import Link from "next/link";

export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  actionHref,
  actionLabel,
}: {
  title: string;
  hint?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card p-10 text-center text-sm text-slate-500">
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1">{hint}</p>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn btn-primary mt-4 inline-flex">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
