import { useEffect, useState } from "react";
import { Check, MessageCircle, Send } from "lucide-react";
import { api } from "../lib/api";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";

export default function WhatsAppPage() {
  const [recipientType, setRecipientType] = useState("phone");
  const [to, setTo] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");
  const [type, setType] = useState("text");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const needsFile = type !== "text";

  const acceptByType = {
    image: "image/*",
    video: "video/*",
    audio: "audio/*",
    voice: "audio/*",
  };

  useEffect(() => {
    if (recipientType !== "group") return undefined;
    let active = true;
    setGroupsLoading(true);
    setGroupsError("");
    api.getWhatsAppGroups()
      .then((result) => {
        if (active) setGroups(Array.isArray(result.groups) ? result.groups : []);
      })
      .catch((error) => {
        if (!active) return;
        setGroups([]);
        setGroupsError(error.message);
      })
      .finally(() => {
        if (active) setGroupsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recipientType]);

  const sendMessage = async (event) => {
    event.preventDefault();
    setSending(true);
    setFeedback(null);
    try {
      const response = await api.sendWhatsAppMessage(to, type, body, file);
      setFeedback({
        type: "success",
        messageId: response.result?.message?.id,
      });
      setBody("");
      setFile(null);
      setFileInputKey((key) => key + 1);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="Kirim pesan melalui Wasender.dev." />

      <Card className="max-w-2xl p-6">
        <form onSubmit={sendMessage} className="flex flex-col gap-5">
          <Field label="Kirim ke">
            <Select
              value={recipientType}
              onChange={(event) => {
                setRecipientType(event.target.value);
                setTo("");
              }}
            >
              <option value="phone">Nomor WhatsApp</option>
              <option value="group">Grup WhatsApp</option>
            </Select>
          </Field>

          {recipientType === "group" ? (
            <Field label="Grup tujuan">
              <Select
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
                disabled={groupsLoading || groups.length === 0}
              >
                <option value="" disabled>
                  {groupsLoading ? "Memuat grup..." : groups.length ? "Pilih grup" : "Tidak ada grup tersedia"}
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.id})
                  </option>
                ))}
              </Select>
              {groupsError && <span role="alert" className="text-[12px] text-danger">{groupsError}</span>}
            </Field>
          ) : (
            <Field label="Nomor penerima">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="6281234567890"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
              <span className="text-[12px] text-ink-faint">Gunakan format internasional, misalnya +62 812-3456-7890.</span>
            </Field>
          )}

          <Field label="Jenis pesan">
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setFile(null);
                setFileInputKey((key) => key + 1);
              }}
            >
              <option value="text">Teks</option>
              <option value="image">Gambar</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="voice">Voice note</option>
              <option value="document">Dokumen</option>
            </Select>
          </Field>

          {needsFile && (
            <Field label="File media">
              <Input
                key={fileInputKey}
                type="file"
                accept={acceptByType[type]}
                required
                className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </Field>
          )}

          <Field label={needsFile ? "Caption (opsional)" : "Pesan"}>
            <Textarea
              rows={7}
              maxLength={4096}
              placeholder={needsFile ? "Tambahkan caption..." : "Tulis pesan..."}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required={!needsFile}
            />
            <span className="text-right text-[12px] text-ink-faint">{body.length}/4096</span>
          </Field>

          {feedback && (
            <div
              role={feedback.type === "error" ? "alert" : "status"}
              className={feedback.type === "error" ? "text-[13px] text-danger" : "text-[13px] text-success"}
            >
              {feedback.type === "error" ? (
                feedback.message
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Check size={15} /> Pesan diterima Wasender.dev; status terkirim belum dikonfirmasi
                  {feedback.messageId ? ` (ID: ${feedback.messageId})` : "."}
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" type="submit" disabled={sending || !to.trim() || (needsFile ? !file : !body.trim())}>
              {sending ? <MessageCircle size={16} className="animate-pulse" /> : <Send size={16} />}
              {sending ? "Mengirim..." : "Kirim pesan"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}