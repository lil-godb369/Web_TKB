"use strict";
(() => {
const D = window.TKB_DATA;
const SO_TUAN = 30, SO_NGAY = 7, SO_TIET = 16;
const TEN_THU = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const BUOI = [["sang", "Sáng", 1, 6], ["chieu", "Chiều", 7, 12], ["toi", "Tối", 13, 16]];
const MAU = ["#2457d6", "#e8590c", "#0f9d58", "#9c36b5", "#d6336c", "#0c8599", "#b08900", "#5f3dc4", "#c92a2a", "#2b8a3e", "#1971c2", "#a61e4d"];
const KHOA = "tkb-xep-lich-v1";
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...con) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of con.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
};
// Giờ học theo TB 1427/TB-DCT (từ HK2 2025–2026). Mỗi tiết 50 phút; mảng = giờ bắt đầu tiết 1..16.
// Bảng 0: LT / phòng lý thuyết / Zoom. Bảng 1: phòng máy, thực hành, thí nghiệm, GDQP-AN, GDTC (không nghỉ giữa giờ).
const phut = (h) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const BD = [
  "06:30 07:20 08:10 09:30 10:20 11:10 12:30 13:20 14:10 15:30 16:20 17:10 18:10 19:00 19:50 20:40",
  "07:00 07:50 08:40 09:30 10:20 11:10 12:30 13:20 14:10 15:00 15:50 16:40 18:00 18:50 19:40 20:30",
].map((x) => x.split(" ").map(phut));
const TEN_BANG = ["giờ lý thuyết", "giờ thực hành / phòng máy (đoán theo tên môn, phòng)"];
// Đoán bảng giờ: dữ liệu không ghi loại buổi, nên dựa vào tên môn và tên phòng.
const MON_TH = /^(thực hành|thí nghiệm)|^giáo dục (quốc phòng|thể chất)/i, PHONG_TH = /phòng máy|thực hành|thí nghiệm/i;
const gio = (bang, tu, den) => [BD[bang][tu - 1], BD[bang][den - 1] + 50];
const gioChu = (bang, tu, den) => gio(bang, tu, den).map(hhmm).join("–");
const boDau = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// ---------- dữ liệu ----------
const tuan1 = new Date(D.tuan1 + "T00:00:00");
const ngayCua = (w, thu) => new Date(tuan1.getTime() + (7 * w + (thu - 2)) * 864e5);
const dm = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

const SEC = new Map();      // mã LHP -> lớp học phần
const THEO_MON = new Map(); // mã môn -> [lớp học phần]
for (const [ma, mon, l, g, e, b] of D.lhp) {
  const monTH = MON_TH.test(D.mon[mon][0]);
  const s = { ma, mon, lop: D.lop[l], gv: D.gv[g].replace(/^\S+ - /, "") || "(chưa có GV)", el: !!e,
    b: b.map(([thu, tu, den, p, mask]) => ({ thu, tu, den, phong: D.phong[p], mask, bang: monTH || PHONG_TH.test(D.phong[p]) ? 1 : 0 })) };
  SEC.set(ma, s);
  if (!THEO_MON.has(mon)) THEO_MON.set(mon, []);
  THEO_MON.get(mon).push(s);
}
const MON = [...THEO_MON.keys()].map((ma) => {
  const [ten, tc] = D.mon[ma];
  return { ma, ten, tc, ds: THEO_MON.get(ma), tim: boDau(ten + " " + ma), lop: new Set(THEO_MON.get(ma).map((s) => s.lop)) };
}).sort((a, b) => a.ten.localeCompare(b.ten, "vi"));
const MON_MAP = new Map(MON.map((m) => [m.ma, m]));
// Ngành / khóa lấy từ mã lớp: 16DHTH01 → khóa "16", ngành "DHTH". Mã lớp không theo mẫu (GDQP…) thì không có ngành.
const tachLop = (l) => { const k = /^(\d{2})(DH[A-Z_]+?)\d*$/.exec(l); return k ? { khoa: k[1], nganh: k[2] } : null; };
const NGANH = [...new Set(D.lop.map((l) => tachLop(l)?.nganh).filter(Boolean))].sort();
const KHOA_LOP = [...new Set(D.lop.map((l) => tachLop(l)?.khoa).filter(Boolean))].sort();

function occ(s) { // Uint16Array[tuần*7+ngày] = bit tiết
  if (s._o) return s._o;
  const o = new Uint16Array(SO_TUAN * SO_NGAY);
  for (const x of s.b) {
    const bits = ((1 << (x.den - x.tu + 1)) - 1) << (x.tu - 1);
    for (let w = 0; w < SO_TUAN; w++) if (x.mask >> w & 1) o[w * SO_NGAY + x.thu - 2] |= bits;
  }
  return (s._o = o);
}
const trung = (a, b) => { const x = occ(a), y = occ(b); for (let i = 0; i < x.length; i++) if (x[i] & y[i]) return true; return false; };
const demNgay = (o) => { let n = 0; for (const v of o) if (v) n++; return n; };
const POP = new Uint8Array(1 << SO_TIET); for (let i = 1; i < POP.length; i++) POP[i] = POP[i >> 1] + (i & 1);
// Tải theo thứ = tổng số tiết cả kỳ rơi vào thứ đó; độ lệch = Σ tải² / 100 (càng nhỏ càng đều).
const taiThu = (o) => { const t = new Array(SO_NGAY).fill(0); for (let i = 0; i < o.length; i++) t[i % SO_NGAY] += POP[o[i]]; return t; };
const doLech = (o) => taiThu(o).reduce((a, x) => a + x * x, 0) / 100;

function tuanChu(mask) {
  const r = []; let i = 0;
  while (i < SO_TUAN) {
    if (!(mask >> i & 1)) { i++; continue; }
    let j = i; while (j + 1 < SO_TUAN && mask >> (j + 1) & 1) j++;
    r.push(i === j ? `${i + 1}` : `${i + 1}–${j + 1}`); i = j + 1;
  }
  return r.join(", ");
}
function gopBuoi(s, w = -1) { // gộp buổi cùng thứ/tiết; w>=0 chỉ lấy tuần đó
  const m = new Map();
  for (const x of s.b) {
    if (w >= 0 && !(x.mask >> w & 1)) continue;
    const k = `${x.thu}-${x.tu}-${x.den}`;
    const g = m.get(k) || { thu: x.thu, tu: x.tu, den: x.den, mask: 0, phong: new Set(), bang: 0 };
    g.bang |= x.bang; g.mask |= w >= 0 ? (1 << w) : x.mask; g.phong.add(x.phong);
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => a.thu - b.thu || a.tu - b.tu);
}
const thuChu = (t) => TEN_THU[t - 2];
const phongChu = (set) => { const a = [...set].map((p) => p.replace(/ - .*$/, "")); return a.length > 2 ? a.slice(0, 2).join(", ") + "…" : a.join(", "); };
const coSo = (set) => [...new Set([...set].map((p) => (p.split(" - ").slice(1).pop() || "").replace(/^.*_\s*/, "").split(",")[0].trim()).filter(Boolean))].join("; ");

// ---------- trạng thái ----------
let st = { chon: [], lop: "", tuan: -1, hoc: [2, 3, 4, 5, 6, 7], tranh: [], uuLop: false, khung: ["", ""], gv: [], nganh: "", khoaN: "", uuNganh: false, cach: "it" };
try { Object.assign(st, JSON.parse(localStorage.getItem(KHOA)) || {}); } catch { /* bỏ */ }
// Bản cũ lưu "ngày muốn nghỉ" (st.nghi) → đổi sang "ngày được đi học" = các ngày không nghỉ.
if (Array.isArray(st.nghi)) { st.hoc = [2, 3, 4, 5, 6, 7, 8].filter((t) => !st.nghi.includes(t)); delete st.nghi; }
if (!Array.isArray(st.hoc)) st.hoc = [2, 3, 4, 5, 6, 7];
if (!Array.isArray(st.gv)) st.gv = [];
st.lop = ""; st.uuLop = false; // đã bỏ ô lớp; ngành / khóa thay thế
st.chon = st.chon.filter((c) => MON_MAP.has(c.m) && (!c.s || SEC.has(c.s)));
let moRong = new Set(), xemTruoc = null, phuongAn = null;
const luu = () => localStorage.setItem(KHOA, JSON.stringify(st));
const mauMon = (ma) => { const i = st.chon.findIndex((c) => c.m === ma); return MAU[(i < 0 ? 0 : i) % MAU.length]; };
const TAT_GV = new Set([...SEC.values()].map((s) => s.gv));
const gvUu = (s) => st.gv.includes(s.gv);
const hopNganh = (l) => { const t = st.nganh && tachLop(l); return !!t && t.nganh === st.nganh && (!st.khoaN || t.khoa === st.khoaN); };
const cungNganh = (s) => hopNganh(s.lop);
const daChonSec = () => st.chon.filter((c) => c.s).map((c) => SEC.get(c.s));
// Mặc định xem tuần đầu có học (chế độ "Cả học kỳ" gộp mọi tuần dễ hiểu lầm là trùng lịch).
const tuanDau = () => { const o = new Uint16Array(SO_TUAN * SO_NGAY); daChonSec().forEach((s) => occ(s).forEach((v, i) => (o[i] |= v)));
  const i = o.findIndex((v) => v); return i < 0 ? 0 : Math.floor(i / SO_NGAY); };
if (!(st.tuan >= 0 && st.tuan < SO_TUAN)) st.tuan = tuanDau();

function bao(msg) {
  const b = $("#bao"); b.textContent = msg; b.classList.add("hien");
  clearTimeout(bao.t); bao.t = setTimeout(() => b.classList.remove("hien"), 2200);
}

// ---------- tìm môn ----------
function veKetQua() {
  const q = boDau($("#tim").value.trim()), go = st.lop.trim().toUpperCase();
  const lop = D.lop.includes(go) ? go : ""; // mã lớp gõ dở thì chưa lọc
  const ul = $("#ket-qua"); ul.innerHTML = "";
  if (!q && !lop && !st.nganh) return;
  const tu = q.split(/\s+/).filter(Boolean);
  // Lớp gõ đúng thì lọc theo lớp (cụ thể hơn); không thì lọc theo ngành / khóa nếu đã chọn.
  const kq = MON.filter((m) => tu.every((t) => m.tim.includes(t)) &&
    (lop ? m.lop.has(lop) : !st.nganh || m.ds.some(cungNganh))).slice(0, 80);
  if (!kq.length) { ul.append(el("li", { class: "da" }, "Không thấy môn nào.")); return; }
  for (const m of kq) {
    const da = st.chon.some((c) => c.m === m.ma);
    ul.append(el("li", { class: da ? "da" : "", title: da ? "Đã chọn" : "Bấm để thêm", onclick: () => themMon(m.ma) },
      el("span", { class: "ten" }, m.ten),
      el("span", { class: "phu-chu" }, `${m.tc} TC · ${m.ds.length} lớp${da ? " · đã chọn" : ""}`)));
  }
}
function themMon(ma, sMa = null) {
  if (st.chon.some((c) => c.m === ma)) { moRong.add(ma); ve(); return; }
  // Không tự gán lớp học phần theo lớp sinh viên: để trống, đại ka chọn tay hoặc bấm Tự xếp.
  st.chon.push({ m: ma, s: sMa, khoa: false });
  if (!sMa) moRong.add(ma);
  phuongAn = null; luu(); ve();
}

// ---------- môn đã chọn ----------
function veDaChon() {
  const ul = $("#da-chon"); ul.innerHTML = "";
  $("#trong").style.display = st.chon.length ? "none" : "";
  const lop = st.lop.trim().toUpperCase();
  for (const c of st.chon) {
    const m = MON_MAP.get(c.m), mau = mauMon(c.m), s = c.s && SEC.get(c.s);
    const khac = daChonSec().filter((x) => x.mon !== c.m);
    const trungVoi = s ? khac.filter((x) => trung(s, x)) : [];
    const tom = s
      ? el("span", { class: "chon-tom" + (trungVoi.length ? " loi" : "") },
          `${s.ma.slice(-2)} · ${s.lop} · ${s.gv}` + (trungVoi.length ? ` · trùng ${trungVoi.map((x) => MON_MAP.get(x.mon).ten).join(", ")}` : ""))
      : el("span", { class: "chon-tom loi" }, "Chưa chọn lớp học phần");
    const mo = moRong.has(c.m);
    const li = el("li", {},
      el("div", { class: "mon-dau", style: `--mau:${mau}`, onclick: () => { mo ? moRong.delete(c.m) : moRong.add(c.m); veDaChon(); } },
        el("span", { class: "ten" }, m.ten, " ", el("span", { class: "nhan-nho" }, `${m.tc} TC`), tom),
        el("button", { class: "nhe", title: c.khoa ? "Bỏ khóa" : "Khóa lớp này khi tự xếp", disabled: !c.s,
          onclick: (e) => { e.stopPropagation(); c.khoa = !c.khoa; luu(); veDaChon(); } }, c.khoa ? "🔒" : "🔓"),
        el("button", { class: "nhe", title: "Bỏ môn", onclick: (e) => { e.stopPropagation(); st.chon = st.chon.filter((x) => x !== c); phuongAn = null; luu(); ve(); } }, "✕")));
    if (mo) li.append(veLuaChon(c, m, khac, lop));
    ul.append(li);
  }
}
function veLuaChon(c, m, khac, lop) {
  const box = el("div", { class: "lua-chon", onmouseleave: () => { xemTruoc = null; veLuoi(); } });
  const ds = m.ds.map((s) => ({ s, t: khac.filter((x) => trung(s, x)) }))
    .sort((a, b) => (b.s.lop === lop) - (a.s.lop === lop) || gvUu(b.s) - gvUu(a.s) || cungNganh(b.s) - cungNganh(a.s) || a.t.length - b.t.length || a.s.ma.localeCompare(b.s.ma));
  for (const { s, t } of ds) {
    const lich = gopBuoi(s).map((g) => el("div", {}, `${thuChu(g.thu)}, ${gioChu(g.bang, g.tu, g.den)} (tiết ${g.tu}–${g.den}) · tuần ${tuanChu(g.mask)} · ${phongChu(g.phong)}`));
    box.append(el("label", { class: t.length ? "trung" : "", onmouseenter: () => { xemTruoc = s.ma === c.s ? null : s.ma; veLuoi(); } },
      el("input", { type: "radio", name: "r" + c.m, checked: s.ma === c.s,
        onchange: () => { c.s = s.ma; xemTruoc = null; phuongAn = null; luu(); ve(); } }),
      el("div", {},
        el("div", {}, el("b", {}, `Lớp ${s.ma.slice(-2)}`), ` · ${s.lop} · ${s.gv}`,
          s.lop === lop ? el("span", { class: "nhan-nho lop-minh" }, "lớp bạn") : null,
          s.lop !== lop && cungNganh(s) ? el("span", { class: "nhan-nho lop-minh" }, "cùng ngành") : null,
          gvUu(s) ? el("span", { class: "nhan-nho lop-minh" }, "GV ưu tiên") : null,
          s.el ? el("span", { class: "nhan-nho" }, "E-learning") : null,
          t.length ? el("span", { class: "nhan-nho do" }, "trùng " + t.map((x) => MON_MAP.get(x.mon).ten).join(", ")) : null),
        el("div", { class: "lich" }, lich, el("div", {}, coSo(new Set(s.b.map((x) => x.phong))))))));
  }
  return box;
}

// ---------- lưới ----------
function veTuan() {
  const sel = $("#tuan"); sel.innerHTML = "";
  sel.append(el("option", { value: -1 }, "Cả học kỳ (gộp mọi tuần)"));
  for (let w = 0; w < SO_TUAN; w++) sel.append(el("option", { value: w }, `Tuần ${w + 1} · ${dm(ngayCua(w, 2))} – ${dm(ngayCua(w, 8))}`));
  sel.value = st.tuan;
}
function veLuoi() {
  const g = $("#luoi"); g.innerHTML = "";
  const w = +st.tuan;
  g.append(el("div", { class: "dau-cot", title: "Giờ bắt đầu theo bảng giờ lý thuyết; buổi thực hành / phòng máy lệch giờ, xem trên từng khối" }, "Tiết"));
  for (let t = 2; t <= 8; t++) g.append(el("div", { class: "dau-cot" }, thuChu(t), w >= 0 ? el("small", {}, dm(ngayCua(w, t))) : null));
  const cotTiet = el("div", { class: "cot-tiet" });
  for (let i = 1; i <= SO_TIET; i++) cotTiet.append(el("div", { class: i === 6 || i === 12 ? "het-buoi" : "" }, el("b", {}, i), el("small", {}, hhmm(BD[0][i - 1]))));
  g.append(cotTiet);

  const ds = daChonSec().map((s) => ({ s, xt: false }));
  if (xemTruoc) {
    const s = SEC.get(xemTruoc);
    ds.forEach((x) => { if (x.s.mon === s.mon) x.an = true; });
    ds.push({ s, xt: true });
  }
  const khoi = [[], [], [], [], [], [], []];
  for (const { s, xt, an } of ds) {
    if (an) continue;
    for (const b of gopBuoi(s, w)) khoi[b.thu - 2].push({ ...b, s, xt });
  }
  khoi.forEach((ks, i) => {
    const cot = el("div", { class: "cot-ngay" });
    for (let t = 1; t <= SO_TIET; t++) cot.append(el("div", { class: "vach" + (t === 6 || t === 12 ? " het-buoi" : "") }));
    ks.sort((a, b) => a.tu - b.tu || b.den - a.den);
    for (const a of ks) {
      const de = ks.filter((b) => b !== a && b.s.mon !== a.s.mon && a.tu <= b.den && b.tu <= a.den);
      a.tr = de.some((b) => a.mask & b.mask);
      a.kt = !a.tr && de.length > 0; // chồng giờ nhưng khác tuần (chỉ gặp khi xem cả học kỳ)
    }
    // chia làn cho các khối chồng nhau
    let cum = [], cuoi = 0;
    const xong = () => {
      const lan = [];
      for (const a of cum) { let j = lan.findIndex((e) => e < a.tu); if (j < 0) { j = lan.length; lan.push(0); } lan[j] = a.den; a.lan = j; }
      cum.forEach((a) => (a.soLan = lan.length)); cum = [];
    };
    for (const a of ks) { if (cum.length && a.tu > cuoi) xong(); cum.push(a); cuoi = Math.max(cuoi, a.den); }
    xong();
    for (const a of ks) {
      const m = MON_MAP.get(a.s.mon), mau = mauMon(a.s.mon);
      cot.append(el("div", {
        class: "khoi" + (a.tr ? " trung" : "") + (a.kt ? " khac-tuan" : "") + (a.xt ? " xem-truoc" : ""),
        style: `top:calc(var(--tiet)*${a.tu - 1} + 1px);height:calc(var(--tiet)*${a.den - a.tu + 1} - 2px);` +
          `left:calc(${(100 / a.soLan) * a.lan}% + 2px);width:calc(${100 / a.soLan}% - 4px);--mau:${mau};--mau-nen:${mau}1f`,
        title: `${m.ten} (${a.s.ma})\n${a.s.lop} · ${a.s.gv}\n${gioChu(a.bang, a.tu, a.den)} (tiết ${a.tu}–${a.den}, ${TEN_BANG[a.bang]}) · tuần ${tuanChu(a.mask)}\n${[...a.phong].join("\n")}`,
      }, a.kt ? el("i", { class: "nhan-kt", title: "Cùng giờ với môn khác nhưng học ở tuần khác — không trùng" }, "khác tuần") : null,
         el("b", {}, m.ten), el("span", { class: "chi-tiet" }, `${gioChu(a.bang, a.tu, a.den)} · ${phongChu(a.phong)}`),
         w < 0 ? el("div", { class: "chi-tiet" }, "Tuần " + tuanChu(a.mask)) : null));
    }
    g.append(cot);
  });
  if (w >= 0 && ds.length && !khoi.some((ks) => ks.length)) g.append(el("div", { class: "trong-tuan" }, "Tuần này không có buổi học nào của các môn đã chọn (có thể là tuần nghỉ)."));
}

// ---------- tổng ----------
function veTong() {
  const ss = daChonSec();
  const tc = st.chon.reduce((n, c) => n + MON_MAP.get(c.m).tc, 0);
  let soTrung = 0;
  for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) if (trung(ss[i], ss[j])) soTrung++;
  const o = new Uint16Array(SO_TUAN * SO_NGAY); ss.forEach((s) => occ(s).forEach((v, i) => (o[i] |= v)));
  const t = $("#tong"); t.innerHTML = "";
  t.append(el("div", {}, el("b", {}, st.chon.length), "môn"), el("div", {}, el("b", {}, tc), "tín chỉ"),
    el("div", {}, el("b", {}, demNgay(o)), "ngày đến trường"),
    el("div", { class: soTrung ? "loi" : "" }, el("b", {}, soTrung), "cặp trùng lịch"));
}

// ---------- tự xếp ----------
function veTuyChon() {
  const ngay = $("#ngay-hoc"); ngay.innerHTML = "";
  for (let t = 2; t <= 8; t++) ngay.append(el("label", {}, el("input", { type: "checkbox", checked: st.hoc.includes(t),
    onchange: (e) => { st.hoc = e.target.checked ? [...st.hoc, t] : st.hoc.filter((x) => x !== t); luu(); } }), thuChu(t)));
  const buoi = $("#tranh-buoi"); buoi.innerHTML = "";
  for (const [k, ten, a, b] of BUOI) buoi.append(el("label", {}, el("input", { type: "checkbox", checked: st.tranh.includes(k),
    onchange: (e) => { st.tranh = e.target.checked ? [...st.tranh, k] : st.tranh.filter((x) => x !== k); luu(); } }), `${ten} (${a}–${b})`));
  $("#cach-xep").value = st.cach === "deu" ? "deu" : "it";
  $("#gio-tu").value = st.khung[0]; $("#gio-den").value = st.khung[1];
}
function veGv() {
  const co = new Map(); // GV -> tên các môn đã chọn GV đó dạy
  for (const c of st.chon) { const m = MON_MAP.get(c.m);
    for (const s of m.ds) if (s.gv !== "(chưa có GV)") { if (!co.has(s.gv)) co.set(s.gv, new Set()); co.get(s.gv).add(m.ten); } }
  st.gv.forEach((g) => co.has(g) || co.set(g, new Set()));
  const loc = boDau($("#gv-loc").value.trim());
  $("#gv-loc").hidden = co.size <= 12;
  const ds = [...co.keys()].sort((a, b) => a.localeCompare(b, "vi")).filter((g) => !loc || st.gv.includes(g) || boDau(g).includes(loc));
  $("#gv-uu").replaceChildren(...(co.size ? ds.map((g) => el("label", { title: [...co.get(g)].join(", ") || "Không dạy môn nào đang chọn" },
    el("input", { type: "checkbox", checked: st.gv.includes(g),
      onchange: (e) => { st.gv = e.target.checked ? [...st.gv, g] : st.gv.filter((x) => x !== g); luu(); veDaChon(); } }), g))
    : [el("span", { class: "muted nho" }, "Chọn môn trước để hiện giáo viên.")]));
}
// Lý do một LHP bị loại khi tự xếp ([] = hợp lệ); `co` = các LHP của môn đã khóa.
function lyDoLoai(s, co = []) {
  const kTu = st.khung[0] ? phut(st.khung[0]) : 0, kDen = st.khung[1] ? phut(st.khung[1]) : 24 * 60;
  const ngay = new Set(), buoi = new Set(); let khung = false;
  for (const x of s.b) {
    const [a, b] = gio(x.bang, x.tu, x.den);
    if (!st.hoc.includes(x.thu)) ngay.add(thuChu(x.thu));
    if (a < kTu || b > kDen) khung = true;
    for (const [k, ten, p, q] of BUOI) if (st.tranh.includes(k) && x.tu <= q && p <= x.den) buoi.add(ten.toLowerCase());
  }
  const r = [];
  if (ngay.size) r.push(`học ${[...ngay].join(", ")} (không tích đi học)`);
  if (buoi.size) r.push(`có buổi ${[...buoi].join(", ")} (đang tránh)`);
  if (khung) r.push("ra ngoài khung giờ");
  const tr = co.filter((x) => trung(s, x));
  if (tr.length) r.push(`trùng môn đã khóa ${tr.map((x) => MON_MAP.get(x.mon).ten).join(", ")}`);
  return r;
}
const hopLe = (s) => !lyDoLoai(s).length;
function tuXep() {
  if (!st.chon.length) { bao("Chưa chọn môn nào."); return; }
  const lop = st.lop.trim().toUpperCase();
  const co = st.chon.filter((c) => c.khoa && c.s).map((c) => SEC.get(c.s));
  const nen = new Uint16Array(SO_TUAN * SO_NGAY); co.forEach((s) => occ(s).forEach((v, i) => (nen[i] |= v)));
  const tu = st.chon.filter((c) => !(c.khoa && c.s));
  const nhom = [];
  for (const c of tu) {
    const ds = MON_MAP.get(c.m).ds.filter((s) => hopLe(s) && !co.some((x) => trung(s, x)));
    if (!ds.length) {
      const m = MON_MAP.get(c.m);
      phuongAn = { loi: `Môn "${m.ten}" không còn lớp nào hợp điều kiện:`,
        lyDo: m.ds.map((s) => `Lớp ${s.ma.slice(-2)} (${s.lop}): ${lyDoLoai(s, co).join("; ")}`) };
      veTuXep(); return;
    }
    nhom.push({ c, ds });
  }
  nhom.sort((a, b) => a.ds.length - b.ds.length);
  const GIU = 50, MAX_NUT = 400000;
  const tot = []; let nut = 0, catNgan = false;
  // Điểm = ngày*10 − thưởng; thưởng mỗi LHP: lớp mình 3, cùng ngành 2 (nếu tick), GV ưu tiên 5 → 2 môn đúng GV ≈ bớt 1 ngày.
  const thuong = (s) => (st.uuLop && s.lop === lop ? 3 : 0) + (st.uuNganh && cungNganh(s) ? 2 : 0) + (gvUu(s) ? 5 : 0);
  const conLai = new Array(nhom.length + 1).fill(0); // tổng thưởng tối đa của các nhóm k..cuối
  for (let k = nhom.length - 1; k >= 0; k--) conLai[k] = conLai[k + 1] + Math.max(...nhom[k].ds.map(thuong));
  // Dàn đều: thay "ngày*10" bằng độ lệch tải giữa các thứ (cũng chỉ tăng khi thêm lớp → vẫn dùng làm cận dưới).
  const deu = st.cach === "deu", chiPhi = (o) => (deu ? doLech(o) : demNgay(o) * 10);
  const diem = (cp, th) => cp - th;
  const nguong = () => (tot.length < GIU ? Infinity : tot[tot.length - 1].d);
  function dfs(k, o, chon, th) {
    if (++nut > MAX_NUT) { catNgan = true; return; }
    const cp = chiPhi(o);
    if (diem(cp, th + conLai[k]) >= nguong()) return; // cận dưới
    if (k === nhom.length) {
      tot.push({ d: diem(cp, th), ngay: demNgay(o), tai: taiThu(o), chon: chon.slice() });
      tot.sort((a, b) => a.d - b.d); if (tot.length > GIU) tot.pop();
      return;
    }
    const ung = nhom[k].ds.map((s) => {
      const so = occ(s), o2 = o.slice(); let tr = false;
      for (let i = 0; i < so.length; i++) { if (o[i] & so[i]) { tr = true; break; } o2[i] |= so[i]; }
      return { s, tr, o2, cp2: tr ? 0 : chiPhi(o2), t: thuong(s) };
    }).filter((x) => !x.tr).sort((a, b) => a.cp2 - b.cp2 || b.t - a.t);
    const lacQuan = th + conLai[k];
    for (const { s, o2, cp2, t } of ung) {
      if (diem(cp2, lacQuan) >= nguong()) break; // ung xếp theo cp2 tăng dần
      chon.push(s.ma); dfs(k + 1, o2, chon, th + t); chon.pop();
      if (catNgan) return;
    }
  }
  dfs(0, nen, [], 0);
  if (!tot.length) { phuongAn = { loi: catNgan ? "Quá nhiều tổ hợp, chưa tìm được. Hãy khóa bớt vài môn rồi thử lại." : "Không có tổ hợp nào không trùng lịch với điều kiện hiện tại." }; veTuXep(); return; }
  phuongAn = { ds: tot.map((x) => ({ ...x, map: new Map(nhom.map((g, i) => [g.c.m, x.chon[i]])) })), i: 0, catNgan };
  apDung(0);
}
function apDung(i) {
  phuongAn.i = i;
  const p = phuongAn.ds[i];
  for (const c of st.chon) if (p.map.has(c.m)) c.s = p.map.get(c.m);
  luu(); ve();
}
const deuTai = (p) => p.tai && p.tai.map((x, d) => x && `${thuChu(d + 2)} ${x}`).filter(Boolean).join(", ");
function veTuXep() {
  const box = $("#phuong-an"); box.innerHTML = "";
  if (!phuongAn) return;
  if (phuongAn.loi) {
    box.append(el("div", { class: "nhan-nho do loi-xep" }, phuongAn.loi,
      ...(phuongAn.lyDo ? [el("ul", {}, ...phuongAn.lyDo.map((t) => el("li", {}, t)))] : [])));
    return;
  }
  const { ds, i } = phuongAn, p = ds[i];
  const thu = new Set(); daChonSec().forEach((s) => s.b.forEach((x) => thu.add(x.thu)));
  const coGv = st.chon.filter((c) => MON_MAP.get(c.m).ds.some(gvUu));
  const dungGv = coGv.filter((c) => c.s && gvUu(SEC.get(c.s))).length;
  box.append(el("div", { class: "dieu-huong" },
    el("button", { disabled: i === 0, onclick: () => apDung(i - 1) }, "‹"),
    el("span", {}, `Phương án ${i + 1}/${ds.length}`),
    el("button", { disabled: i === ds.length - 1, onclick: () => apDung(i + 1) }, "›")),
    el("p", { class: "muted nho" }, `${p.ngay} ngày đến trường cả kỳ · học ${[...thu].sort().map(thuChu).join(", ")}` +
      (deuTai(p) ? ` · số tiết cả kỳ theo thứ: ${deuTai(p)}` : "") +
      (coGv.length ? ` · ${dungGv}/${coGv.length} môn đúng GV ưu tiên` : "") +
      (phuongAn.catNgan ? " · đã dừng sớm vì quá nhiều tổ hợp, có thể còn phương án tốt hơn" : "")));
}

// ---------- chung ----------
function ve() { veKetQua(); veDaChon(); veLuoi(); veTong(); veTuXep(); veGv(); }

$("#tieu-de").textContent = D.tieuDe.replace(/\s+/g, " ") + ` · tuần 1 bắt đầu ${dm(tuan1)}/${tuan1.getFullYear()}`;
$("#nganh").append(...NGANH.map((n) => el("option", { value: n }, n)));
$("#khoa-n").append(...KHOA_LOP.map((k) => el("option", { value: k }, "Khóa " + k)));
const veNganh = () => { $("#nganh").value = st.nganh; $("#khoa-n").value = st.khoaN; $("#uu-tien-nganh").checked = st.uuNganh;
  $("#them-nganh").disabled = !st.nganh; };
veNganh();
$("#nganh").addEventListener("change", (e) => { st.nganh = e.target.value; phuongAn = null; luu(); veNganh(); ve(); });
$("#khoa-n").addEventListener("change", (e) => { st.khoaN = e.target.value; phuongAn = null; luu(); ve(); });
$("#uu-tien-nganh").addEventListener("change", (e) => { st.uuNganh = e.target.checked; luu(); });
$("#cach-xep").addEventListener("change", (e) => { st.cach = e.target.value; luu(); });
$("#them-nganh").addEventListener("click", () => {
  if (!st.nganh) return;
  const ds = MON.filter((m) => m.ds.some(cungNganh) && !st.chon.some((c) => c.m === m.ma));
  const ten = st.nganh + (st.khoaN ? " khóa " + st.khoaN : "");
  if (!ds.length) { bao(`Không còn môn nào của ngành ${ten} để thêm.`); return; }
  if (ds.length > 15 && !confirm(`Thêm ${ds.length} môn của ngành ${ten}? (chưa chọn lớp học phần, bấm Tự xếp để chọn)` +
    (st.khoaN ? "" : " Gợi ý: chọn khóa để bớt môn."))) return;
  for (const m of ds) st.chon.push({ m: m.ma, s: null, khoa: false });
  phuongAn = null; luu(); ve(); bao(`Đã thêm ${ds.length} môn của ngành ${ten}.`);
});
$("#tim").addEventListener("input", veKetQua);
$("#xoa-het").addEventListener("click", () => { if (st.chon.length && confirm("Bỏ hết các môn đã chọn?")) { st.chon = []; phuongAn = null; luu(); ve(); } });
for (const [i, id] of [[0, "#gio-tu"], [1, "#gio-den"]]) $(id).addEventListener("change", (e) => { st.khung[i] = e.target.value; luu(); });
$("#gv-loc").addEventListener("input", veGv);
$("#gio-bo").addEventListener("click", () => { st.khung = ["", ""]; veTuyChon(); luu(); });
$("#tu-xep").addEventListener("click", () => { const b = $("#tu-xep"); b.disabled = true; b.textContent = "Đang xếp…";
  setTimeout(() => { try { tuXep(); } finally { b.disabled = false; b.textContent = "Tự xếp"; } }, 20); });
$("#tuan").addEventListener("change", (e) => { st.tuan = +e.target.value; luu(); veLuoi(); });
$("#tuan-truoc").addEventListener("click", () => { st.tuan = Math.max(-1, st.tuan - 1); $("#tuan").value = st.tuan; luu(); veLuoi(); });
$("#tuan-sau").addEventListener("click", () => { st.tuan = Math.min(SO_TUAN - 1, st.tuan + 1); $("#tuan").value = st.tuan; luu(); veLuoi(); });
$("#chep-ma").addEventListener("click", async () => {
  const txt = st.chon.map((c) => `${c.s || "(chưa chọn)"}\t${MON_MAP.get(c.m).ten}`).join("\n");
  if (!txt) { bao("Chưa có môn nào."); return; }
  try { await navigator.clipboard.writeText(txt); } catch {
    const t = el("textarea", { style: "position:fixed;opacity:0" }); t.value = txt; document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
  }
  bao("Đã chép danh sách mã lớp học phần.");
});
$("#in").addEventListener("click", () => window.print());
veTuan(); veTuyChon(); ve();
})();
