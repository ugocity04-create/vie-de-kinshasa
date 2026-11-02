// COMPTES : inscription / connexion avec pseudo + mot de passe (Supabase) et sauvegarde dans le nuage.
const Auth = (function () {
  "use strict";
  const A = { user: null, enabled: false };
  const DOMAIN = "@vie-kinshasa.game";
  let sb = null, tok = "", saveT = null, lastJson = "", ui = null;
  const ok = () => typeof SUPABASE_URL === "string" && SUPABASE_URL && SUPABASE_KEY;
  A.enabled = ok();
  A.token = () => tok;
  function client() { if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }); sb.auth.onAuthStateChange((e, s) => { tok = s ? s.access_token : ""; }); return sb; }
  const userName = (u) => String(u.email || "").split("@")[0];
  async function finish(session) {
    tok = session.access_token; A.user = { id: session.user.id, username: userName(session.user) };
    let cloud = null; try { const r = await sb.from("saves").select("data").eq("id", A.user.id).maybeSingle(); if (r.data) cloud = r.data.data; } catch (e) {}
    return { username: A.user.username, cloud, id: A.user.id };
  }
  function css() {
    const s = document.createElement("style"); s.textContent = "#auth{position:fixed;inset:0;z-index:60;background:linear-gradient(165deg,#0a2f7a,#1167c9 55%,#f2b632 130%);display:grid;place-items:center;padding:16px;font-family:system-ui,sans-serif;color:#fff}#auth .box{width:min(380px,100%);background:rgba(8,18,40,.82);border-radius:22px;padding:22px;display:grid;gap:12px;box-shadow:0 20px 50px rgba(0,0,0,.5)}#auth h1{margin:0;text-align:center;font-size:1.6rem}#auth p{margin:0;text-align:center;opacity:.8;font-size:.9rem}#auth .tabs{display:flex;gap:6px;background:#0d1f45;border-radius:14px;padding:4px}#auth .tabs button{flex:1;padding:10px;border:0;border-radius:11px;background:none;color:#fff;font:600 .9rem system-ui}#auth .tabs button.on{background:#f7c948;color:#222}#auth input{padding:13px;border-radius:13px;border:1px solid #2b4378;background:#0a1730;color:#fff;font:1rem system-ui;width:100%;box-sizing:border-box}#auth .go{padding:14px;border:0;border-radius:14px;background:#1b9a52;color:#fff;font:700 1rem system-ui}#auth .err{color:#ff9d8f;min-height:1.2em;font-size:.88rem;text-align:center}"; document.head.appendChild(s);
  }
  function showUI(resolve) {
    css(); const d = document.createElement("div"); d.id = "auth"; let mode = "in";
    d.innerHTML = '<div class="box"><h1>🇨🇩 La vie de Kinshasa</h1><p>Connecte-toi pour retrouver ta progression partout.</p><div class="tabs"><button data-m="in" class="on">Connexion</button><button data-m="up">Créer un compte</button></div><input id="au-u" placeholder="Pseudo (lettres, chiffres, _)" maxlength="16" autocapitalize="none" autocomplete="username"><input id="au-p" type="password" placeholder="Mot de passe (6 caractères minimum)" autocomplete="current-password"><div class="err" id="au-e"></div><button class="go" id="au-go">Se connecter</button></div>';
    document.body.appendChild(d); ui = d;
    const $ = (id) => d.querySelector("#" + id), err = (m) => { $("au-e").textContent = m || ""; };
    d.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => { mode = b.dataset.m; d.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); $("au-go").textContent = mode === "in" ? "Se connecter" : "Créer mon compte"; err(""); });
    async function go() {
      const u = $("au-u").value.trim().toLowerCase().replace(/^@/, ""), p = $("au-p").value; err("");
      if (!/^[a-z0-9_]{3,16}$/.test(u)) return err("Pseudo : 3 à 16 caractères (lettres, chiffres ou _).");
      if (p.length < 6) return err("Mot de passe : 6 caractères minimum.");
      $("au-go").disabled = true; $("au-go").textContent = "…";
      try {
        let session;
        if (mode === "up") {
          const ex = await sb.from("profiles").select("id").eq("username", u).maybeSingle(); if (ex.data) throw new Error("Ce pseudo est déjà pris.");
          const r = await sb.auth.signUp({ email: u + DOMAIN, password: p }); if (r.error) throw r.error;
          if (!r.data.session) throw new Error("Compte créé, mais la confirmation e-mail est activée dans Supabase. Désactive-la (voir le guide).");
          session = r.data.session; const ins = await sb.from("profiles").insert({ id: session.user.id, username: u }); if (ins.error) throw new Error("Ce pseudo est déjà pris.");
        } else { const r = await sb.auth.signInWithPassword({ email: u + DOMAIN, password: p }); if (r.error) throw new Error("Pseudo ou mot de passe incorrect."); session = r.data.session; }
        d.remove(); resolve(await finish(session));
      } catch (e) { err(String(e.message || e).replace("Invalid login credentials", "Pseudo ou mot de passe incorrect.")); $("au-go").disabled = false; $("au-go").textContent = mode === "in" ? "Se connecter" : "Créer mon compte"; }
    }
    $("au-go").onclick = go; d.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
  // Retourne { username, cloud } quand le joueur est connecté (ou null si les comptes sont désactivés).
  A.ready = async function () {
    if (!A.enabled) return null;
    if (!window.supabase) { document.body.insertAdjacentHTML("beforeend", '<div id="auth"><div class="box"><h1>Connexion impossible</h1><p>Vérifie ta connexion internet puis recharge la page.</p></div></div>'); css(); return new Promise(() => {}); }
    client();
    try { const r = await sb.auth.getSession(); if (r.data.session) return await finish(r.data.session); } catch (e) {}
    return new Promise((res) => showUI(res));
  };
  A.queueSave = function (S) {
    if (!A.user || !sb) return; clearTimeout(saveT);
    saveT = setTimeout(() => A.flush(S), 8000); A._S = S;
  };
  A.flush = async function (S) {
    S = S || A._S; if (!A.user || !sb || !S) return; const json = JSON.stringify(S); if (json === lastJson) return; lastJson = json;
    try { await sb.from("saves").upsert({ id: A.user.id, data: S, updated_at: new Date().toISOString() }); } catch (e) { lastJson = ""; }
  };
  A.logout = async function () { try { await A.flush(); await sb.auth.signOut(); } catch (e) {} try { localStorage.removeItem("lvk-save-v3"); } catch (e) {} location.reload(); };
  document.addEventListener("visibilitychange", () => { if (document.hidden) A.flush(); });
  window.addEventListener("pagehide", () => A.flush());
  return A;
})();
