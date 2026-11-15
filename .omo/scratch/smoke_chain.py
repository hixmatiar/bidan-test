import json, os, random, subprocess, sys, urllib.request, urllib.error, datetime

BASE = "http://127.0.0.1:4105/api/v1"
P = os.environ["SAPWD"]
results = []

def db(sql):
    out = subprocess.run(["docker","exec","-i","sql_server_pikachen","/opt/mssql-tools18/bin/sqlcmd",
        "-I","-C","-S","localhost","-U","sa","-P",P,"-d","PraktikBidan","-b","-h","-1","-W","-s","|"],
        input=sql, capture_output=True, text=True)
    return [l for l in out.stdout.splitlines() if l.strip()]

def call(method, path, body=None, token=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE+path, data=data, method=method)
    req.add_header("Content-Type","application/json")
    if token: req.add_header("Authorization","Bearer "+token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            try: return r.status, json.loads(raw.decode() or "{}")
            except Exception: return r.status, {"_raw_prefix": raw[:5].decode(errors="ignore")}
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or "{}")
        except Exception: return e.code, {}

def as_rows(b):
    d = b.get("data")
    if isinstance(d, list): return d
    if isinstance(d, dict):
        for k in ("data","items","rows"):
            if isinstance(d.get(k), list): return d[k]
    return []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ")+name+(" | "+str(detail)[:180] if detail else ""))

def login(u,p):
    s,b = call("POST","/auth/login",{"username":u,"password":p})
    return s, (b.get("data") or {}).get("token"), b

today = datetime.date.today().isoformat()
s,tb,lb = login("bidan","Bidan#2026")
check("login bidan", s==200 and tb, (s, lb.get("error_code")))
s,ta,la = login("admin","Admin#2026")
check("login admin", s==200 and ta, (s, la.get("error_code")))
if not tb or not ta: sys.exit(1)

s,b = call("POST","/public/layanan/list",{},tb)
check("public layanan list", s==200 and isinstance(b.get("data"),list) and len(b["data"])>=8, (s, type(b.get("data")).__name__))
s,b = call("POST","/public/sesi/list",{},tb)
check("public sesi list", s==200, s)
layanan_id = db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),layanan_id) FROM dbo.layanan WHERE is_active=1 ORDER BY nama;")[0].strip()

rows = db(f"SET NOCOUNT ON; SELECT TOP 2 CONVERT(varchar(36),sesi_id) FROM dbo.sesi_praktik WHERE tanggal > CAST(GETDATE() AS date) AND is_active=1 ORDER BY tanggal, jam_mulai;")
sesi_id = rows[0].strip() if rows else None
sesi_id2 = rows[1].strip() if len(rows)>1 else sesi_id
item = db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),item_id) FROM dbo.item_inventaris ORDER BY nama;")[0].strip()
check("db fixtures", layanan_id and sesi_id and item, (layanan_id, sesi_id, item))

nik = "9" + "".join(str(random.randint(0,9)) for _ in range(15))
phone = "0812" + "".join(str(random.randint(0,9)) for _ in range(8))
s,b = call("POST","/public/pasien/cek",{"nik":nik},tb)
print("INFO public pasien/cek new nik ->", s, b.get("error_code") or b.get("status"))

s,b = call("POST","/public/reservasi",{"sesi_id":sesi_id,"layanan_id":layanan_id,
    "pasien_baru":{"nik":nik,"nama":"Pasien Uji E2E","tgl_lahir":"1995-04-12","no_telepon":phone,"alamat":"Jl. Uji 1"}},tb)
check("public reservasi", s in (200,201), (s, b.get("error_code"), b.get("message")))
res_id = (b.get("data") or {}).get("reservasi_id")
check("reservasi id returned", bool(res_id), res_id)

s,b = call("POST","/pasien/identitas/list",{"q":nik},ta)
items = as_rows(b)
pasien_id = items[0]["pasien_id"] if items else None
check("pasien identitas list by nik", s==200 and pasien_id, (s, len(items)))

s,b = call("POST","/reservasi/list",{"q":nik},ta)
items = as_rows(b)
check("reservasi list by q", s==200 and any(x.get("reservasi_id")==res_id for x in items), (s, len(items)))

s,b = call("PATCH",f"/reservasi/{res_id}/jadwal",{"sesi_id_baru":sesi_id2,"alasan":"QA pindah sesi"},ta)
check("reservasi reschedule", s in (200,201), (s, b.get("error_code")))
s,b = call("PATCH",f"/reservasi/{res_id}/status",{"status":"DIPANGGIL"},tb)
check("reservasi status DIPANGGIL", s==200, (s, b.get("error_code")))

s,b = call("POST",f"/pasien/{pasien_id}/red-flag/konfirmasi",{},tb)
check("red-flag konfirmasi", s in (200,201) and (b.get("data") or {}).get("confirmed") is True, (s, b.get("error_code"), b.get("data")))

s,b = call("POST",f"/pasien/{pasien_id}/kunjungan",{"reservasi_id":res_id,"layanan_id":layanan_id,
    "keluhan":"Pusing","pemeriksaan_fisik":"TD 120/80","diagnosis":"Observasi","tindakan":"Pemeriksaan",
    "resep":[{"item_id":item,"jumlah":2,"aturan_pakai":"3x1"}]},tb)
check("kunjungan create + resep TVP", s in (200,201), (s, b.get("error_code"), b.get("message")))
kun_id = (b.get("data") or {}).get("kunjungan_id")

s,b = call("POST",f"/pasien/{pasien_id}/rme/detail",{},tb)
check("rme detail", s==200 and (b.get("data") or {}).get("pasien"), (s, b.get("error_code")))

s,b = call("POST",f"/pasien/{pasien_id}/rme/export",{},tb)
check("rme export pdf", s==200, (s, b.get("error_code")))

s,b = call("POST",f"/kunjungan/{kun_id}/tagihan/detail",{},ta)
tid = (b.get("data") or {}).get("tagihan_id")
d = b.get("data") or {}; total = d.get("total_tagihan") or d.get("total") or d.get("grand_total")
check("tagihan detail after visit", s==200 and tid and total, (s, tid, total))

s,b = call("POST","/tagihan/list",{},ta)
check("tagihan list", s==200, (s, b.get("error_code")))

s,b = call("POST",f"/tagihan/{tid}/pembayaran",{"jumlah":float(total or 0),"jalur":"MANDIRI"},ta)
check("pembayaran", s in (200,201), (s, b.get("error_code"), b.get("message")))

s,b = call("POST","/keuangan/rekap/list",{"dari":today,"sampai":today},ta)
check("keuangan rekap", s==200, (s, b.get("error_code")))

s,b = call("PATCH",f"/reservasi/{res_id}/status",{"status":"SELESAI"},tb)
check("reservasi status SELESAI", s==200, (s, b.get("error_code")))

inventaris_id = db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),item_id) FROM dbo.item_inventaris;")[0].strip()
for name, method, path, body, tok in [
    ("STUB laporan ringkasan","POST","/laporan/ringkasan/list",{"dari":today,"sampai":today},ta),
    ("STUB laporan export","POST","/laporan/export",{"dari":today,"sampai":today,"format":"PDF"},ta),
    ("STUB konten list","POST","/konten/list",{},ta),
    ("STUB notifikasi log","POST","/notifikasi/log/list",{},ta),
    ("STUB audit logs","POST","/audit-logs/list",{},ta),
    ("STUB restock","POST",f"/inventaris/{inventaris_id}/restock",{"jumlah":1},ta),
]:
    s,b = call(method,path,body,tok)
    print(f"INFO {name} -> {s} {b.get('error_code') or ''}")

passed = sum(1 for _,ok,_ in results if ok)
print(f"\nSUMMARY {passed}/{len(results)} passed")
for n,ok,d in results:
    if not ok: print("  FAILED:", n, d)
sys.exit(0 if passed==len(results) else 1)