"""Chuyển file TKB .xls của trường thành data/data.js cho web xếp lịch.

  python tools/build_data.py "<đường dẫn file .xls>"

Cột (từ dòng 9): STT, Mã LHP, Tên môn, Tính chất, Phòng, Số TC, Lớp, Thứ, Từ tiết, Đến tiết, Số tiết,
Bắt đầu, T1..T30, Kết thúc, Tổng số tiết, Giảng viên.
Mã môn = Mã LHP bỏ 2 số cuối (số thứ tự lớp). Thứ 8 = Chủ nhật.
"""
import collections
import datetime
import json
import os
import sys

import xlrd

GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RA = os.path.join(GOC, "data", "data.js")


def s(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def main(tep):
    sys.stdout.reconfigure(encoding="utf-8")
    sh = xlrd.open_workbook(tep).sheet_by_index(0)
    tieu_de = s(sh.cell_value(3, 0))
    bang = {"gv": [], "phong": [], "lop": []}
    chi_so = {k: {} for k in bang}

    def idx(loai, v):
        d = chi_so[loai]
        if v not in d:
            d[v] = len(bang[loai])
            bang[loai].append(v)
        return d[v]

    mon = {}          # mã môn -> [tên, tc]
    lhp = collections.OrderedDict()  # mã LHP -> dict
    moc_tuan = collections.Counter()
    loi = []
    for r in range(8, sh.nrows):
        h = sh.row_values(r)
        ma = s(h[1])
        if not ma or not ma.isdigit():
            continue
        ten, tc, lop, gv = s(h[2]), int(h[5] or 0), s(h[6]), s(h[44])
        thu, tu, den = int(h[7]), int(h[8]), int(h[9])
        tuan = [i for i in range(30) if s(h[12 + i])]
        if not tuan:
            loi.append((ma, "không có tuần"))
            continue
        # kiểm mốc: ngày bắt đầu = thứ hai tuần 1 + 7*(tuần đầu) + (thứ-2)
        try:
            bd = datetime.datetime(*xlrd.xldate_as_tuple(h[11], 0)[:3]) if isinstance(h[11], float) \
                else datetime.datetime.strptime(s(h[11]), "%d/%m/%Y")
            moc_tuan[(bd - datetime.timedelta(days=7 * tuan[0] + (thu - 2))).date()] += 1
        except (ValueError, TypeError):
            pass
        ma_mon = ma[:-2]
        if ma_mon not in mon:
            mon[ma_mon] = [ten, tc]
        elif mon[ma_mon][0] != ten:
            loi.append((ma, f"tên khác: {mon[ma_mon][0]} / {ten}"))
        x = lhp.get(ma)
        if not x:
            x = lhp[ma] = {"m": ma_mon, "l": idx("lop", lop), "g": idx("gv", gv),
                           "e": 1 if "learning" in s(h[3]).lower() else 0, "b": []}
        mask = sum(1 << i for i in tuan)
        x["b"].append([thu, tu, den, idx("phong", s(h[4])), mask])

    moc = moc_tuan.most_common(3)
    print("Tiêu đề:", tieu_de)
    print("Mốc thứ hai tuần 1:", moc)
    print("Môn:", len(mon), "· LHP:", len(lhp), "· GV:", len(bang["gv"]), "· phòng:", len(bang["phong"]),
          "· lớp:", len(bang["lop"]))
    print("Cảnh báo:", len(loi), loi[:5])

    du_lieu = {"tieuDe": tieu_de, "tuan1": moc[0][0].isoformat(), "mon": mon, "gv": bang["gv"],
               "phong": bang["phong"], "lop": bang["lop"],
               "lhp": [[ma, x["m"], x["l"], x["g"], x["e"], x["b"]] for ma, x in lhp.items()]}
    os.makedirs(os.path.dirname(RA), exist_ok=True)
    with open(RA, "w", encoding="utf-8") as f:
        f.write("window.TKB_DATA=")
        json.dump(du_lieu, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("Ghi", RA, os.path.getsize(RA) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1])
