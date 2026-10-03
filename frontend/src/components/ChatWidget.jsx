import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bot, Grip, Maximize2, MessageCircle, Minimize2, Send, X } from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { api } from "../lib/api";

function prepareChatMarkdown(text) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => `$$\n${formula.trim()}\n$$`)
    .replace(/^\s*\[([^\]\r\n]*\\[A-Za-z]+[^\]\r\n]*)\]\s*$/gm, (_, formula) => `$$\n${formula.trim()}\n$$`);
}

function remarkChatBreaks() {
  return (tree) => {
    const transformChildren = (node) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "html" && /^<br\s*\/?>$/i.test(child.value.trim())) {
          return [{ type: "break" }];
        }
        transformChildren(child);
        return [child];
      });
    };
    transformChildren(tree);
  };
}

function buildSuggestions(members, tasks, messages) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text || "";
  const normalizedMessage = latestUserMessage.toLocaleLowerCase();
  const sentSuggestions = new Set(
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.text.trim().toLocaleLowerCase())
  );
  const mentionedTask = tasks.find((task) =>
    normalizedMessage.includes(task.title.toLocaleLowerCase())
  );
  const mentionedMember = members.find((member) =>
    normalizedMessage.includes(member.name.toLocaleLowerCase())
  );
  const workloadContext = /workload|beban|kapasitas|sibuk|overload/i.test(latestUserMessage);
  const suggestions = [];
  const add = (suggestion) => {
    if (suggestion && !sentSuggestions.has(suggestion.toLocaleLowerCase())) {
      suggestions.push(suggestion);
    }
  };

  if (mentionedTask) {
    if (mentionedTask.status === "todo") add(`Mulai task "${mentionedTask.title}"`);
    if (mentionedTask.status === "in_progress") add(`Tandai tugas "${mentionedTask.title}" selesai`);
    if (mentionedTask.status === "done") add(`Buat tugas lanjutan dari "${mentionedTask.title}"`);
    add(`Tampilkan status tugas "${mentionedTask.title}"`);
    add(`Ubah deadline tugas "${mentionedTask.title}"`);
  }

  if (mentionedMember) {
    if (workloadContext) add(`Tampilkan tugas aktif ${mentionedMember.name}`);
    else add(`Cek workload ${mentionedMember.name} minggu ini`);
    add(`Tugas apa yang belum selesai untuk ${mentionedMember.name}?`);
    add(`Tugas apa yang sedang dikerjakan ${mentionedMember.name}?`);
  } else if (workloadContext) {
    add("Siapa yang workload-nya paling tinggi minggu ini?");
    add("Tampilkan ringkasan workload seluruh tim minggu ini");
  }

  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
  const activeTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((left, right) => (priorityRank[left.priority] ?? 4) - (priorityRank[right.priority] ?? 4));
  activeTasks.forEach((task) => {
    if (task.status === "todo") add(`Mulai task "${task.title}"`);
    else add(`Tampilkan status tugas "${task.title}"`);
  });

  if (mentionedMember && activeTasks.length) {
    const memberTask = activeTasks.find((task) => task.assignee_id === mentionedMember.id);
    if (memberTask?.status === "todo") add(`Mulai task "${memberTask.title}"`);
    if (memberTask?.status === "in_progress") add(`Tampilkan status tugas "${memberTask.title}"`);
  }

  members.forEach((member) => add(`Cek workload ${member.name} minggu ini`));
  add("Tampilkan semua tugas yang belum dikerjakan");
  add("Ringkas workload tim minggu ini");
  return suggestions.slice(0, 4);
}

const CONFIRMATION_FIELD_LABELS = {
  title: "Judul",
  description: "Deskripsi",
  assignee_id: "Penanggung jawab",
  priority: "Prioritas",
  estimated_hours: "Estimasi jam",
  status: "Status",
  start_date: "Tanggal mulai",
  due_date: "Deadline",
};

export default function ChatWidget({ members = [], onDataChanged }) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 380, height: 560 });
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Halo! Aku bisa bantu membuat query SQL, mengelola tugas, atau mengecek workload. Cukup ketik dengan bahasa sehari-hari.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(null);
  const textareaRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const wasOpenRef = useRef(false);
  const resizeStart = useRef(null);

  const refreshSuggestions = () => {
    api.getTasks().then(setTasks).catch(() => setTasks([]));
  };

  useEffect(() => {
    if (open) refreshSuggestions();
  }, [open]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!open || !container) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
    wasOpenRef.current = true;
  }, [messages, open, sending]);

  const resizePanel = (event) => {
    if (!resizeStart.current) return;
    const start = resizeStart.current;
    setPanelSize({
      width: Math.max(320, Math.min(window.innerWidth - 32, start.width + start.x - event.clientX)),
      height: Math.max(320, Math.min(window.innerHeight - 48, start.height + start.y - event.clientY)),
    });
  };

  const startResize = (event) => {
    event.preventDefault();
    resizeStart.current = { x: event.clientX, y: event.clientY, ...panelSize };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const sendCurrent = () => send();

  const resolveConfirmation = async (token, confirmed) => {
    setConfirmationBusy(token);
    try {
      const result = await api.confirmChat(token, confirmed);
      setMessages((current) => current.map((message) => ({
        ...message,
        confirmations: message.confirmations?.map((item) =>
          item.token === token ? { ...item, resolved: true } : item
        ),
      })));
      setMessages((current) => [...current, { role: "bot", text: result.reply }]);
      if (result.action && result.action !== "none") {
        if (result.action.includes("sql")) {
          window.dispatchEvent(new Event("saved-queries-changed"));
        }
        onDataChanged();
        refreshSuggestions();
      }
    } catch (error) {
      setMessages((current) => [...current, {
        role: "bot",
        text: error.message || "Konfirmasi gagal diproses. Minta AI menyiapkan perubahan lagi.",
      }]);
    } finally {
      setConfirmationBusy(null);
    }
  };

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "40px";
    setSending(true);
    try {
      const history = messages
        .slice(1)
        .map((item) => ({
          role: item.role === "user" ? "user" : "assistant",
          content: item.text,
        }))
        .slice(-10);
      const res = await api.sendChat(msg, history);
      setMessages((m) => [...m, {
        role: "bot",
        text: res.reply,
        confirmations: res.confirmations,
      }]);
      const actions = res.actions?.length ? res.actions : [res];
      if (actions.some((action) => action.action === "save_sql_query")) {
        window.dispatchEvent(new Event("saved-queries-changed"));
      }
      if (actions.some((action) => action.action && action.action !== "none")) {
        onDataChanged();
        refreshSuggestions();
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: e.message || "Maaf, terjadi kesalahan. Coba lagi." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div
          style={!fullscreen ? {
            width: `min(${panelSize.width}px, max(280px, calc(100vw - 2rem)))`,
            height: `min(${panelSize.height}px, max(320px, calc(100dvh - 7rem)))`,
          } : undefined}
          className={clsx(
            "fixed z-40 flex flex-col overflow-hidden border border-line/70 bg-surface shadow-popover",
            fullscreen
              ? "inset-3 rounded-xl md:inset-6"
              : "bottom-24 right-4 min-h-[320px] min-w-[min(320px,calc(100vw-2rem))] rounded-2xl md:bottom-6 md:right-24"
          )}
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
            <Bot size={17} className="text-accent" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">Asisten Workload</span>
            <button
              type="button"
              onClick={() => setFullscreen((value) => !value)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
              aria-label={fullscreen ? "Keluar dari fullscreen" : "Fullscreen"}
              title={fullscreen ? "Keluar dari fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-ink/[0.06] hover:text-ink"
              aria-label="Tutup chat"
              title="Tutup chat"
            >
              <X size={17} />
            </button>
          </div>

          <div ref={messagesContainerRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-accent-solid text-white rounded-br-md"
                    : "bg-ink/[0.05] text-ink rounded-bl-md"
                )}
              >
                {m.role === "user" ? (
                  <span className="select-text whitespace-pre-wrap break-words">{m.text}</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath, remarkChatBreaks]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
                      h1: ({ children }) => <h1 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0">{children}</h3>,
                      ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>,
                      ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>,
                      li: ({ children }) => <li className="pl-0.5">{children}</li>,
                      blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-line pl-3 text-ink-soft">{children}</blockquote>,
                      code: ({ className, children }) => (
                        <code className={clsx(
                          "font-mono",
                          className ? "text-[12px]" : "rounded bg-ink/[0.07] px-1 py-0.5 text-[0.92em]",
                          className
                        )}>{children}</code>
                      ),
                      pre: ({ children }) => <pre className="my-2 max-w-full overflow-x-auto rounded-md border border-line/70 bg-canvas px-3 py-2 text-[12px] leading-relaxed">{children}</pre>,
                      table: ({ children }) => (
                        <div className="my-2 max-w-full overflow-x-auto rounded-md border border-line/70">
                          <table className="w-max min-w-full border-collapse text-left text-[12px]">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-ink/[0.04]">{children}</thead>,
                      th: ({ children }) => <th className="whitespace-nowrap border-b border-line px-2.5 py-1.5 font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border-b border-line/70 px-2.5 py-1.5 align-top">{children}</td>,
                      a: ({ children, href }) => <a className="text-accent underline underline-offset-2" href={href}>{children}</a>,
                      hr: () => <hr className="my-2 border-line" />,
                    }}
                  >
                    {prepareChatMarkdown(m.text)}
                  </ReactMarkdown>
                )}
                {m.confirmations?.map((confirmation) => (
                  <div key={confirmation.token} className="mt-3 w-full min-w-[240px] space-y-2 rounded-lg border border-line bg-surface p-3 text-ink shadow-soft">
                    <div className="text-[12px] font-semibold text-ink">
                      {confirmation.operation === "delete" ? "Task yang akan dihapus" : "Perubahan task"}
                    </div>
                    {confirmation.items.map((item, itemIndex) => (
                      <div key={`${item.title}-${itemIndex}`} className="border-t border-line/70 pt-2 first:border-0 first:pt-0">
                        <div className="text-[12px] font-semibold">{item.title}</div>
                        {item.changes?.map((change) => (
                          <div key={change.field} className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                            {change.field}: {change.before} <span aria-hidden="true">→</span> {change.after}
                          </div>
                        ))}
                        {item.record && Object.entries(item.record).map(([field, value]) => (
                          <div key={field} className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                            {CONFIRMATION_FIELD_LABELS[field] || field}: {value}
                          </div>
                        ))}
                      </div>
                    ))}
                    {confirmation.resolved ? (
                      <div className="border-t border-line/70 pt-2 text-[11px] text-ink-faint">Konfirmasi telah ditanggapi.</div>
                    ) : (
                      <div className="flex justify-end gap-2 border-t border-line/70 pt-2">
                        <button
                          type="button"
                          onClick={() => resolveConfirmation(confirmation.token, false)}
                          disabled={confirmationBusy === confirmation.token}
                          className="rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-ink/[0.04] disabled:opacity-50"
                        >
                          Batalkan
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveConfirmation(confirmation.token, true)}
                          disabled={confirmationBusy === confirmation.token}
                          className="rounded-md bg-accent-solid px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-solid-hover disabled:opacity-50"
                        >
                          {confirmationBusy === confirmation.token ? "Memproses..." : "Konfirmasi"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {sending && (
              <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-ink/[0.05] px-3.5 py-2 text-[13.5px] text-ink-soft">
                Mengetik…
              </div>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5">
            {buildSuggestions(members, tasks, messages).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="shrink-0 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-accent/15"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-line px-3 py-3">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Tulis pesan..."
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  sendCurrent();
                }
              }}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={() => send()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-solid text-white hover:bg-accent-solid-hover disabled:opacity-40"
              disabled={!input.trim() || sending}
              aria-label="Kirim"
            >
              <Send size={16} />
            </button>
          </div>
          {!fullscreen && (
            <button
              type="button"
              onPointerDown={startResize}
              onPointerMove={resizePanel}
              onPointerUp={() => { resizeStart.current = null; }}
              className="absolute bottom-1 left-1 flex h-7 w-7 touch-none cursor-nesw-resize items-center justify-center rounded text-ink-faint hover:bg-ink/[0.06] hover:text-ink"
              aria-label="Ubah ukuran panel chat"
              title="Tarik untuk mengubah ukuran"
            >
              <Grip size={15} />
            </button>
          )}
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-solid text-white shadow-popover transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
          aria-label="Buka chat"
        >
          <MessageCircle size={22} />
        </button>
      )}
    </>
  );
}
