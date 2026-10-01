import clsx from "clsx";

export function SkeletonBlock({ className }) {
  return <div className={clsx("animate-pulse rounded-md bg-ink/[0.08]", className)} />;
}

export function SkeletonTaskCard() {
  return (
    <div className="mb-2.5 rounded-xl border border-line/70 bg-white p-3.5">
      <div className="flex items-center gap-1.5">
        <SkeletonBlock className="h-4 w-14" />
        <SkeletonBlock className="h-4 w-16" />
      </div>
      <SkeletonBlock className="mt-2 h-4 w-4/5" />
      <SkeletonBlock className="mt-2.5 h-3 w-1/2" />
      <div className="mt-3 flex gap-1.5 border-t border-line pt-2.5">
        <SkeletonBlock className="h-6 w-20 rounded-full" />
        <SkeletonBlock className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTaskRow() {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-3">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="mt-2 h-4 w-40" />
      </td>
      <td className="px-3 py-3">
        <SkeletonBlock className="h-6 w-24 rounded-full" />
      </td>
      <td className="px-3 py-3">
        <SkeletonBlock className="h-8 w-32 rounded-lg" />
      </td>
      <td className="px-3 py-3">
        <SkeletonBlock className="h-8 w-28 rounded-lg" />
      </td>
      <td className="px-3 py-3">
        <SkeletonBlock className="h-4 w-20" />
      </td>
      <td className="px-3 py-3">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
      </td>
      <td className="px-3 py-3">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="mt-2 h-4 w-20" />
      </td>
      <td className="px-3 py-3" />
    </tr>
  );
}
