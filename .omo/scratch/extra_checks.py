import json,os,random,urllib.request,urllib.error,datetime,subprocess
BASE="http://127.0.0.1:4105/api/v1"; P=os.environ["SAPWD"]
def db(sql):
    o=subprocess.run(["docker","exec","-i","sql_server_pikachen","/opt/mssql-tools18/bin/sqlcmd","-I","-C","-S","localhost","-U","sa","-P",P,"-d","PraktikBidan","-b","-h","-1","-W","-s","|"],input=sql,capture_output=True,text=True)
    return [l for l in o.stdout.splitlines() if l.strip()]
def call(m,p,b=None,t=None):
    d=None if b is None else json.dumps(b).encode(); r=urllib.request.Request(BASE+p,data=d,method=m); r.add_header("Content-Type","application/json")
    if t: r.add_header("Authorization","Bearer "+t)
    try:
        with urllib.request.urlopen(r,timeout=30) as x: return x.status,json.loads(x.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try: return e.code,json.loads(e.read().decode() or "{}")
        except: return e.code,{}
def login(u,p):
    s,b=call("POST","/auth/login",{"username":u,"password":p}); return (b.get("data") or {}).get("token")
ta=login("admin","Admin#2026"); tb=login("bidan","Bidan#2026")
nik="9"+"".join(str(random.randint(0,9)) for _ in range(15)); ph="0813"+"".join(str(random.randint(0,9)) for _ in range(8))
rows0=db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),sesi_id) FROM dbo.sesi_praktik WHERE tanggal > CAST(GETDATE() AS date) AND is_active=1;"); sid0=rows0[0].strip()
lay0=db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),layanan_id) FROM dbo.layanan WHERE is_active=1;")[0].strip()
s,b=call("POST","/pasien/walk-in",{"sesi_id":sid0,"layanan_id":lay0,"pasien_baru":{"nik":nik,"nama":"Walkin Uji","tgl_lahir":"1990-01-01","no_telepon":ph}},ta)
print("walk-in",s,b.get("error_code"),b.get("message")); print("metode",(b.get("data") or {}).get("reservasi",{}).get("metode_daftar"))
pid=(b.get("data") or {}).get("pasien_id"); print("walkin_pasien",pid)
rows=db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),sesi_id) FROM dbo.sesi_praktik WHERE tanggal > CAST(GETDATE() AS date) AND is_active=1;"); sid=rows[0].strip()
lay=db("SET NOCOUNT ON; SELECT TOP 1 CONVERT(varchar(36),layanan_id) FROM dbo.layanan WHERE is_active=1;")[0].strip()
s,b=call("POST","/public/reservasi",{"sesi_id":sid,"layanan_id":lay,"pasien_baru":{"nik":nik,"nama":"Walkin Uji","tgl_lahir":"1990-01-01","no_telepon":ph}},tb)
rid=(b.get("data") or {}).get("reservasi_id"); print("reservasi2",s,rid)
s,b=call("PATCH",f"/reservasi/{rid}/batal",{"alasan":"QA batal"},ta)
print("batal",s,b.get("error_code"))
print("db_status",db(f"SET NOCOUNT ON; SELECT status FROM dbo.reservasi WHERE reservasi_id='{rid}';"))
