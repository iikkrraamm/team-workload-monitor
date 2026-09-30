import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import TaskCard from "./TaskCard";
import EmptyState from "./ui/EmptyState";
import { SkeletonTaskCard } from "./ui/Skeleton";

const PAGE_SIZE = 30;

export default function KanbanColumn({
  statusKey,
  label,
  filters,
  reloadTick,
  columns,
  memberById,
  onOpen,
  onMove,
  onCopy,
}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true); // first page for this filter set
  const [loadingMore, setLoadingMore] = useState(false); // subsequent pages
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);

  const filterKey = JSON.stringify(filters);

  // Filters (or an outside mutation via reloadTick) changed — start this
  // column over from page 1 rather than trying to patch the existing list,
  // since a status/assignee/etc. change can add, remove, or reorder items
  // in ways that are simplest to just re-fetch correctly.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setPage(0);
    api
      .getTasksPage({ ...filters, status: [statusKey] }, 1, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setPage(1);
        setLoading(false);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, filterKey, reloadTick]);

  const hasMore = items.length < total;

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    api
      .getTasksPage({ ...filters, status: [statusKey] }, page + 1, PAGE_SIZE)
      .then((data) => {
        setItems((prev) => [...prev, ...data.items]);
        setTotal(data.total);
        setPage((p) => p + 1);
        setLoadingMore(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingMore(false);
      });
  };

  // Scroll-triggered lazy loading: observe a sentinel at the bottom of this
  // column's own scroll area (not the page), so each column loads more
  // independently as the user scrolls it, Trello-style.
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { root, rootMargin: "120px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasMore, page, filterKey, statusKey]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
        {label}
        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] text-ink-soft">
          {loading ? "…" : total}
        </span>
      </div>

      <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto pr-0.5">
        {loading ? (
          <>
            <SkeletonTaskCard />
            <SkeletonTaskCard />
          </>
        ) : (
          <>
            {items.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                assignee={memberById[t.assignee_id]}
                columns={columns}
                currentStatus={statusKey}
                onOpen={() => onOpen(t)}
                onMove={(newStatus) => onMove(t, newStatus)}
                onCopy={onCopy}
              />
            ))}
            {items.length === 0 && <EmptyState>Tidak ada tugas</EmptyState>}

            {/* Sentinel: entering view triggers loadMore(). Also holds the
                loading-more indicator, and a manual fallback button for
                trackpads/wheels that don't fire intersection reliably. */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-2">
                {loadingMore ? (
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                    <Loader2 size={13} className="animate-spin" /> Memuat lebih banyak...
                  </span>
                ) : (
                  <button
                    onClick={loadMore}
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    Muat lebih banyak
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
