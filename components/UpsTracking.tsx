"use client";

import { useEffect, useRef, useState } from "react";

type Row = {
  code: string;
  status?: string;
  rawStatus?: string;
  checkedAt?: string;
  error?: string;
};
type Response = Partial<Row> & { ok: boolean; fatal?: boolean; version?: string };
const UPS_EXTENSION_VERSION = "0.1.5";

function request(action: "ping" | "track", code?: string): Promise<Response> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const finish = (result: Response) => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
      resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin
        || event.data?.source !== "hahoa-ups-extension" || event.data.requestId !== requestId) return;
      finish(event.data);
    };
    const timer = window.setTimeout(() => finish({ ok: false, fatal: true,
      error: action === "ping" ? "Chưa kết nối tiện ích UPS. Cài tiện ích rồi tải lại trang."
        : "Tiện ích không phản hồi. Kiểm tra tab UPS và tải lại tiện ích trước khi thử lại.",
    }), action === "ping" ? 2000 : 60000);
    window.addEventListener("message", receive);
    window.postMessage({ source: "hahoa-ups-page", requestId, action, code }, location.origin);
  });
}

export function UpsTracking({ userId }: { userId: string }) {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Chưa kiểm tra kết nối");
  const stop = useRef(false);
  const mounted = useRef(true);
  const locked = useRef(false);
  const storageKey = `hahoa-ups-v1:${userId}`;

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(saved)) setRows(saved.filter((row) => row && typeof row.code === "string"
          && /^[A-Z0-9]{7,34}$/.test(row.code)).slice(0, 500).map((row) => ({
            code: row.code,
            ...Object.fromEntries(["status", "rawStatus", "checkedAt", "error"]
              .filter((key) => typeof row[key] === "string").map((key) => [key, row[key]])),
          })));
      } catch { setNotice("Không đọc được bảng đã lưu trên trình duyệt."); }
      void request("ping").then((response) => {
        if (mounted.current) setConnection(response.ok ? `Đã kết nối UPS ${response.version}` : response.error || "Chưa kết nối");
      });
    }, 0);
    return () => { mounted.current = false; stop.current = true; window.clearTimeout(timer); };
  }, [storageKey]);

  function save(next: Row[]) {
    setRows(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setNotice("Không lưu được vào trình duyệt. Hãy xuất CSV để giữ kết quả."); }
  }

  function addCodes() {
    const codes = [...new Set(input.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
    const invalid = codes.filter((code) => !/^[A-Z0-9]{7,34}$/.test(code));
    if (invalid.length) { setNotice(`Mã không hợp lệ: ${invalid.slice(0, 5).join(", ")}. Chỉ dán cột mã, mỗi mã 7–34 ký tự chữ hoặc số.`); return; }
    const existing = new Set(rows.map((row) => row.code));
    const added = codes.filter((code) => !existing.has(code)).map((code) => ({ code }));
    if (rows.length + added.length > 500) { setNotice("Mỗi bảng tối đa 500 mã."); return; }
    save([...rows, ...added]);
    setInput("");
    setNotice(`Đã thêm ${added.length} mã; bỏ qua mã trùng.`);
  }

  async function run(errorsOnly = false) {
    if (locked.current) return;
    locked.current = true;
    stop.current = false;
    setRunning(true);
    setNotice("");
    let next = [...rows];
    try {
      const ping = await request("ping");
      if (!mounted.current) return;
      setConnection(ping.ok ? `Đã kết nối UPS ${ping.version}` : ping.error || "Chưa kết nối");
      if (!ping.ok) { setNotice(ping.error || "Chưa kết nối tiện ích UPS."); return; }
      for (let index = 0; index < next.length; index++) {
        if (stop.current || !mounted.current) break;
        const row = next[index];
        if (errorsOnly && !row.error) continue;
        setCurrent(row.code);
        const result = await request("track", row.code);
        if (!mounted.current) break;
        if (result.ok && result.code === row.code && typeof result.status === "string"
          && typeof result.checkedAt === "string") {
          next = next.map((item, i) => i === index ? { code: row.code, status: result.status,
            rawStatus: result.rawStatus, checkedAt: result.checkedAt } : item);
        } else {
          next = next.map((item, i) => i === index ? { ...item, error: result.error || "Kết quả không khớp mã yêu cầu." } : item);
        }
        save(next);
        if (result.fatal) { setNotice(result.error || "Đã dừng lượt tra cứu."); break; }
      }
    } finally {
      locked.current = false;
      if (mounted.current) { setRunning(false); setCurrent(""); }
    }
  }

  function exportCsv() {
    const escape = (value = "") => `"${value.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [["Mã UPS", "Trạng thái", "Trạng thái gốc", "Lần tra thành công", "Lỗi lần tra mới nhất"],
      ...rows.map((row) => [row.code, row.status, row.rawStatus, row.checkedAt, row.error])]
      .map((line) => line.map((value) => escape(value)).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "ups-tracking.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="ups-tracking">
    <div className="ups-card">
      <div className="ups-actions">
        <strong>{connection}</strong>
        <a className="secondary-button" href={`/ups-tracking-extension.zip?v=${UPS_EXTENSION_VERSION}`} download>Tải tiện ích UPS</a>
        <button className="secondary-button" disabled={running} onClick={async () => {
          const result = await request("ping");
          setConnection(result.ok ? `Đã kết nối UPS ${result.version}` : result.error || "Chưa kết nối");
        }}>Kiểm tra kết nối</button>
      </div>
      <details><summary>Hướng dẫn cài trên Chrome / Edge</summary>
        <ol><li>Tải và giải nén tiện ích UPS.</li><li>Mở chrome://extensions hoặc edge://extensions, bật Chế độ nhà phát triển.</li>
          <li>Chọn “Tải tiện ích đã giải nén”, chọn thư mục chứa manifest.json rồi tải lại trang này.</li></ol>
      </details>
      <p>Tiện ích mở tab UPS ở nền để tra từng mã. Giữ trình duyệt và trang này mở trong lúc chạy.</p>
      <label htmlFor="ups-codes">Dán cột mã UPS từ Excel hoặc nhập mỗi mã một dòng</label>
      <textarea id="ups-codes" value={input} onChange={(event) => setInput(event.target.value)} disabled={running} placeholder="1Z064H260334937790" />
      <div className="ups-actions">
        <button className="secondary-button" disabled={running || !input.trim()} onClick={addCodes}>Thêm vào bảng</button>
        <button className="primary-button" disabled={running || !rows.length} onClick={() => void run()}>Cập nhật tracking</button>
        <button className="secondary-button" disabled={running || !rows.some((row) => row.error)} onClick={() => void run(true)}>Thử lại mã lỗi</button>
        {running && <button className="secondary-button" onClick={() => { stop.current = true; setNotice("Sẽ dừng sau mã đang tra."); }}>Dừng sau mã này</button>}
        <button className="secondary-button" disabled={!rows.length} onClick={exportCsv}>Xuất CSV</button>
        <button className="text-button" disabled={running || !rows.length} onClick={() => {
          if (window.confirm("Xóa toàn bộ bảng tracking trên trình duyệt này?")) save([]);
        }}>Xóa bảng</button>
      </div>
      <p className="muted">Bảng lưu riêng theo tài khoản trên trình duyệt này, chưa đồng bộ sang máy khác. “Đã giao hàng” không có nghĩa là “Đã thanh toán”.</p>
      <div role="status" aria-live="polite">{current && <p>Đang tra {current}…</p>}{notice && <p>{notice}</p>}</div>
    </div>
    <div className="ups-card ups-table-wrap">
      <table className="ups-table"><caption>{rows.length} mã UPS · {rows.filter((row) => row.status).length} mã có kết quả · {rows.filter((row) => row.error).length} mã lỗi</caption>
        <thead><tr><th scope="col">Mã vận đơn</th><th scope="col">Trạng thái gần nhất</th><th scope="col">Lần tra thành công</th><th scope="col">Lần tra mới nhất</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.code}>
          <td><a href={`https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(row.code)}`} target="_blank" rel="noreferrer">{row.code}</a></td>
          <td><strong>{row.status || "Chưa có kết quả"}</strong>{row.rawStatus && <div className="muted">{row.rawStatus}</div>}</td>
          <td>{row.checkedAt && Number.isFinite(Date.parse(row.checkedAt)) ? new Date(row.checkedAt).toLocaleString("vi-VN") : "—"}</td>
          <td>{current === row.code ? "Đang tra…" : row.error || (row.status ? "Thành công" : "Chưa tra")}</td>
        </tr>)}{!rows.length && <tr><td colSpan={4}>Chưa có mã vận đơn. Dán cột mã phía trên để bắt đầu.</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}
