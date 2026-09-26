import { useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";

const SUGGESTIONS = [
  "tambah task 'Review kode' untuk Budi prioritas tinggi 3 jam due besok",
  "workload Sari minggu ini",
  "tandai selesai Review kode",
];

export default function ChatWidget({ onDataChanged }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Halo! Aku bisa bantu tambah tugas, update status, hapus tugas, atau cek workload — cukup ketik dengan bahasa sehari-hari.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.sendChat(msg);
      setMessages((m) => [...m, { role: "bot", text: res.reply }]);
      if (res.action && res.action !== "none") onDataChanged();
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: "Maaf, terjadi kesalahan. Coba lagi." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-40 flex h-[70vh] max-h-[560px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-popover md:bottom-6 md:right-24">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
            <Bot size={17} className="text-accent" />
            <span className="text-[14px] font-semibold text-ink">Asisten Workload</span>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-accent text-white rounded-br-md"
                    : "bg-ink/[0.05] text-ink rounded-bl-md"
                )}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-ink/[0.05] px-3.5 py-2 text-[13.5px] text-ink-soft">
                Mengetik…
              </div>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5">
            {SUGGESTIONS.map((s) => (
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
            <input
              placeholder="Ketik perintah..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="h-10 flex-1 rounded-full border border-line bg-white px-4 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={() => send()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-40"
              disabled={!input.trim() || sending}
              aria-label="Kirim"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-popover transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        aria-label={open ? "Tutup chat" : "Buka chat"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
