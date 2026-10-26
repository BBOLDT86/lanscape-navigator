import sys, os
V = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(V, "..", "..", "index.html")
t = open(V + "template2.html").read()
data = (open(V + "data2.js").read() + "\n" + open(V + "brazil_data.js").read()).replace("</", "<\\/")
eng = open(V + "engine.js").read()
app = "\n".join(open(V + f).read() for f in ["app_core.js", "app_views.js", "app_views2.js", "app_views3.js", "app_views4.js", "app_brazil.js", "app_shell.js"])
for part in (eng, app):
    assert "</script" not in part.lower()
t = t.replace("/*__DATA__*/", data).replace("/*__ENGINE__*/", eng).replace("/*__APP__*/", app)
open(out, "w").write(t)
print("wrote", out, round(len(t) / 1024), "KB")
