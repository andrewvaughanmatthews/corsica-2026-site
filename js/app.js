// ---- Lock screen (shared password, with Face ID/Touch ID as a device shortcut) ----
(function lock() {
  const PASSKEY_KEY = "corsica-passkey-id";
  const body = document.body;
  const gate = document.getElementById("gate");
  if (!gate) return;

  const lead = document.getElementById("gate-lead");
  const passwordForm = document.getElementById("gate-password-form");
  const passwordInput = document.getElementById("gate-password-input");
  const passwordSubmit = document.getElementById("gate-password-submit");
  const errorMsg = document.getElementById("gate-error");
  const faceIdBtn = document.getElementById("gate-faceid-btn");
  const usePasswordLink = document.getElementById("gate-use-password");
  const enableFaceId = document.getElementById("gate-enable-faceid");
  const enableFaceIdBtn = document.getElementById("gate-enable-faceid-btn");
  const skipFaceIdBtn = document.getElementById("gate-skip-faceid");

  function bufToBase64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64urlToBuf(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }
  function randomBytes(len) {
    return crypto.getRandomValues(new Uint8Array(len));
  }

  function closeGate() {
    body.classList.remove("is-locked");
    gate.style.display = "none";
  }

  function platformAuthAvailable() {
    return window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
  }

  function maybeOfferFaceId() {
    if (platformAuthAvailable() && !localStorage.getItem(PASSKEY_KEY)) {
      platformAuthAvailable()().then((available) => {
        if (available) {
          passwordForm.hidden = true;
          faceIdBtn.hidden = true;
          usePasswordLink.hidden = true;
          enableFaceId.hidden = false;
        } else {
          closeGate();
        }
      });
    } else {
      closeGate();
    }
  }

  function showFaceIdStep() {
    passwordForm.hidden = true;
    faceIdBtn.hidden = false;
    usePasswordLink.hidden = false;
    lead.textContent = "Unlock with Face ID, or use the password.";
  }

  function showPasswordStep() {
    passwordForm.hidden = false;
    faceIdBtn.hidden = true;
    usePasswordLink.hidden = true;
    lead.textContent = "Enter the family password to continue.";
  }

  async function registerPasskey() {
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: randomBytes(32),
          rp: { name: "Corsica '26" },
          user: { id: randomBytes(16), name: "family", displayName: "Family" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
        },
      });
      if (cred) {
        localStorage.setItem(PASSKEY_KEY, bufToBase64url(cred.rawId));
      }
    } catch (err) {
      alert("Couldn't set up Face ID on this device — you can try again next time.");
    }
    closeGate();
  }

  async function authenticateWithPasskey(credId) {
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials: [{ id: base64urlToBuf(credId), type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (assertion) closeGate();
    } catch (err) {
      // Cancelled or failed — fall back to password.
      showPasswordStep();
    }
  }

  passwordSubmit.addEventListener("click", () => {
    if (passwordInput.value === CONFIG.SITE_PASSWORD) {
      errorMsg.hidden = true;
      maybeOfferFaceId();
    } else {
      errorMsg.hidden = false;
    }
  });
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") passwordSubmit.click();
  });

  faceIdBtn.addEventListener("click", () => {
    const credId = localStorage.getItem(PASSKEY_KEY);
    if (credId) authenticateWithPasskey(credId);
  });
  usePasswordLink.addEventListener("click", showPasswordStep);
  enableFaceIdBtn.addEventListener("click", registerPasskey);
  skipFaceIdBtn.addEventListener("click", closeGate);

  // Entry point: if a passkey is already registered on this device, offer
  // Face ID first; otherwise start with the password field.
  const existingCredId = localStorage.getItem(PASSKEY_KEY);
  if (existingCredId) {
    showFaceIdStep();
  } else {
    showPasswordStep();
  }
})();

// ---- Forum (Google Form for posting, Apps Script for reading/deleting) ----
(function forum() {
  const postLink = document.getElementById("forum-post-link");
  const feed = document.getElementById("forum-feed");
  const nameInput = document.getElementById("forum-name-input");
  const nameSave = document.getElementById("forum-name-save");
  if (!feed) return;

  const NAME_KEY = "forum-my-name";
  nameInput.value = localStorage.getItem(NAME_KEY) || "";
  nameSave.addEventListener("click", () => {
    localStorage.setItem(NAME_KEY, nameInput.value.trim());
    render();
  });

  if (CONFIG.FORUM_FORM_URL) {
    postLink.href = CONFIG.FORUM_FORM_URL;
  } else {
    postLink.href = "#";
    postLink.textContent = "Form link coming soon";
    postLink.classList.add("btn--disabled");
  }

  if (!CONFIG.SHEETS_API_URL) {
    feed.innerHTML = `<p class="muted">Not wired up yet — add SHEETS_API_URL in js/config.js.</p>`;
    return;
  }

  let posts = [];

  function myName() {
    return (localStorage.getItem(NAME_KEY) || "").trim().toLowerCase();
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s || "";
    return div.innerHTML;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function likedKey(row) { return `forum-liked-${row}`; }

  function shareText(p) {
    let text = `${p.name} on Corsica '26: ${p.message}`;
    if (p.link) text += ` ${p.link}`;
    return text;
  }

  function renderReplies(p) {
    if (!p.replies || !p.replies.length) return "";
    return `<div class="forum-post__replies">${p.replies.map((r) => `
      <div class="forum-reply">
        <strong>${escapeHtml(r.name)}</strong>
        <span class="muted">${formatDate(r.timestamp)}</span>
        <p>${escapeHtml(r.message)}</p>
      </div>`).join("")}</div>`;
  }

  function render() {
    if (!posts.length) {
      feed.innerHTML = `<p class="muted">No posts yet — be the first.</p>`;
      return;
    }
    feed.innerHTML = posts.map((p) => {
      const canDelete = myName() && p.name && p.name.trim().toLowerCase() === myName();
      const linkHtml = p.link ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noopener">${escapeHtml(p.link)}</a>` : "";
      const alreadyLiked = localStorage.getItem(likedKey(p.row));
      const likedBy = p.likedBy || [];
      return `
        <div class="forum-post" data-row="${p.row}">
          <div class="forum-post__head">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="muted">${formatDate(p.timestamp)}</span>
          </div>
          <p>${escapeHtml(p.message)}</p>
          ${linkHtml}
          <div class="forum-post__actions">
            <button class="forum-post__like${alreadyLiked ? " is-liked" : ""}" data-row="${p.row}">♡ ${p.likes || 0}</button>
            ${likedBy.length ? `<button type="button" class="forum-post__likers-toggle" data-row="${p.row}">who?</button>` : ""}
            <button class="forum-post__reply-toggle" data-row="${p.row}">Reply</button>
            <button class="forum-post__share" data-row="${p.row}">Share</button>
            ${canDelete ? `<button class="forum-post__delete" data-row="${p.row}">Delete</button>` : ""}
          </div>
          ${likedBy.length ? `<div class="forum-post__likers muted" hidden>Liked by ${escapeHtml(likedBy.join(", "))}</div>` : ""}
          ${renderReplies(p)}
          <div class="forum-post__reply-form" hidden>
            <input type="text" class="reply-input" placeholder="Write a reply...">
            <button class="btn btn--outline reply-submit" data-row="${p.row}">Send</button>
          </div>
        </div>`;
    }).join("");

    feed.querySelectorAll(".forum-post__delete").forEach((btn) => {
      btn.addEventListener("click", () => deletePost(btn.dataset.row));
    });
    feed.querySelectorAll(".forum-post__like").forEach((btn) => {
      btn.addEventListener("click", () => likePost(btn.dataset.row));
    });
    feed.querySelectorAll(".forum-post__likers-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const list = btn.closest(".forum-post").querySelector(".forum-post__likers");
        if (list) list.hidden = !list.hidden;
      });
    });
    feed.querySelectorAll(".forum-post__share").forEach((btn) => {
      btn.addEventListener("click", () => sharePost(btn.dataset.row));
    });
    feed.querySelectorAll(".forum-post__reply-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const form = btn.closest(".forum-post").querySelector(".forum-post__reply-form");
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector(".reply-input").focus();
      });
    });
    feed.querySelectorAll(".reply-submit").forEach((btn) => {
      btn.addEventListener("click", () => submitReply(btn.dataset.row, btn));
    });
  }

  function load() {
    feed.innerHTML = `<p class="muted">Loading…</p>`;
    fetch(`${CONFIG.SHEETS_API_URL}?type=forum`)
      .then((r) => r.json())
      .then((data) => { posts = data; render(); })
      .catch(() => { feed.innerHTML = `<p class="muted">Couldn't load posts right now.</p>`; });
  }

  function deletePost(row) {
    const name = localStorage.getItem(NAME_KEY) || "";
    fetch(CONFIG.SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete", row: Number(row), name }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.ok) load(); else alert("Couldn't delete — name didn't match."); })
      .catch(() => alert("Couldn't delete — try again."));
  }

  function likePost(row) {
    if (localStorage.getItem(likedKey(row))) return;
    let name = localStorage.getItem(NAME_KEY) || "";
    if (!name) {
      name = (prompt("Your name, so people can see who liked this:") || "").trim();
      if (name) localStorage.setItem(NAME_KEY, name);
    }
    if (!name) return;
    fetch(CONFIG.SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "like", row: Number(row), name }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          localStorage.setItem(likedKey(row), "1");
          const p = posts.find((x) => Number(x.row) === Number(row));
          if (p) { p.likes = res.likes; p.likedBy = res.likedBy; }
          render();
        }
      })
      .catch(() => {});
  }

  function submitReply(row, btn) {
    let name = localStorage.getItem(NAME_KEY) || "";
    if (!name) {
      name = (prompt("Your name, so people know who replied:") || "").trim();
      if (name) localStorage.setItem(NAME_KEY, name);
    }
    if (!name) return;
    const form = btn.closest(".forum-post__reply-form");
    const input = form.querySelector(".reply-input");
    const message = input.value.trim();
    if (!message) return;
    btn.disabled = true;
    fetch(CONFIG.SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "reply", row: Number(row), name, message }),
    })
      .then((r) => r.json())
      .then((res) => {
        btn.disabled = false;
        if (res.ok) { input.value = ""; load(); }
        else alert("Couldn't post reply — try again.");
      })
      .catch(() => { btn.disabled = false; alert("Couldn't post reply — try again."); });
  }

  function sharePost(row) {
    const p = posts.find((x) => Number(x.row) === Number(row));
    if (!p) return;
    const text = shareText(p);
    const url = location.href.split("#")[0] + "#forum";
    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        alert("Copied — paste it into WhatsApp, Messages, email, wherever.");
      });
    } else {
      prompt("Copy this to share:", `${text} ${url}`);
    }
  }

  load();
})();

// ---- Editable itinerary (same Apps Script backend as the forum) ----
(function itinerary() {
  const days = Array.from(document.querySelectorAll(".timeline .day"));
  if (!days.length || !CONFIG.SHEETS_API_URL) return;

  const NAME_KEY = "forum-my-name";

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s || "";
    return div.innerHTML;
  }

  // Pull live plans from the sheet and drop them into the matching day card.
  fetch(`${CONFIG.SHEETS_API_URL}?type=itinerary`)
    .then((r) => r.json())
    .then((rows) => {
      rows.forEach((row) => {
        const card = days.find((d) => Number(d.dataset.row) === Number(row.row));
        if (card && row.plan) setPlanText(card, row.plan, row.editedBy);
      });
    })
    .catch(() => {});

  function setPlanText(card, text, editedBy) {
    const p = card.querySelector(".day-plan");
    p.textContent = text;
    let caption = card.querySelector(".day-edited-by");
    if (editedBy) {
      if (!caption) {
        caption = document.createElement("div");
        caption.className = "day-edited-by muted";
        card.querySelector(".day-edit-link").insertAdjacentElement("beforebegin", caption);
      }
      caption.textContent = `Updated by ${editedBy}`;
    } else if (caption) {
      caption.remove();
    }
  }

  days.forEach((card) => {
    const editLink = document.createElement("button");
    editLink.className = "day-edit-link";
    editLink.textContent = "Edit";
    card.appendChild(editLink);

    editLink.addEventListener("click", () => startEdit(card));
  });

  function startEdit(card) {
    if (card.classList.contains("day--editing")) return;
    const p = card.querySelector(".day-plan");
    const currentText = p.textContent;

    card.classList.add("day--editing");
    const textarea = document.createElement("textarea");
    textarea.className = "day-edit-textarea";
    textarea.value = currentText;
    p.replaceWith(textarea);
    textarea.focus();

    const actions = document.createElement("div");
    actions.className = "day-edit-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn--outline";
    saveBtn.textContent = "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "day-edit-cancel";
    cancelBtn.textContent = "Cancel";
    actions.append(saveBtn, cancelBtn);
    textarea.insertAdjacentElement("afterend", actions);

    card.querySelector(".day-edit-link").style.display = "none";

    cancelBtn.addEventListener("click", () => endEdit(card, textarea, actions, currentText, null));
    saveBtn.addEventListener("click", () => {
      let name = localStorage.getItem(NAME_KEY) || "";
      if (!name) {
        name = (prompt("Your name, so others can see who updated this:") || "").trim();
        if (name) localStorage.setItem(NAME_KEY, name);
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      fetch(CONFIG.SHEETS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "update_itinerary", row: Number(card.dataset.row), plan: textarea.value, editedBy: name }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.ok) endEdit(card, textarea, actions, textarea.value, name);
          else { alert("Couldn't save — try again."); saveBtn.disabled = false; saveBtn.textContent = "Save"; }
        })
        .catch(() => { alert("Couldn't save — try again."); saveBtn.disabled = false; saveBtn.textContent = "Save"; });
    });
  }

  function endEdit(card, textarea, actions, finalText, editedBy) {
    const p = document.createElement("p");
    p.className = "day-plan";
    p.textContent = finalText;
    textarea.replaceWith(p);
    actions.remove();
    card.classList.remove("day--editing");
    card.querySelector(".day-edit-link").style.display = "";
    if (editedBy) setPlanText(card, finalText, editedBy);
  }
})();

// ---- Countdown / day counter ----
(function countdown() {
  const el = document.getElementById("countdown");
  const labelEl = document.getElementById("countdown-label");
  const start = new Date(CONFIG.TRIP_START);
  const end = new Date(CONFIG.TRIP_END);

  function render() {
    const now = new Date();

    if (now < start) {
      const diffMs = start - now;
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      labelEl.textContent = "Until wheels up";
      el.textContent = days > 0
        ? `${days}d ${hours}h ${mins}m`
        : `${hours}h ${mins}m`;
    } else if (now >= start && now <= end) {
      const dayNum = Math.floor((now - start) / 86400000) + 1;
      const totalDays = Math.ceil((end - start) / 86400000);
      labelEl.textContent = "Currently on the trip";
      el.textContent = `Day ${dayNum} of ${totalDays}`;
    } else {
      labelEl.textContent = "";
      el.textContent = "That's a wrap — see you next time 👋";
    }
  }

  render();
  setInterval(render, 60000);
})();

// ---- Contacts directory ----
(function contacts() {
  const wrap = document.getElementById("contacts-grid");
  if (!wrap) return;
  wrap.innerHTML = CONFIG.CONTACTS.map((c) => {
    if (!c.phone) {
      const linkHtml = c.link
        ? `<div class="contact-card__links"><a class="contact-card__phone" href="${c.link}" target="_blank" rel="noopener">View on map</a></div>`
        : "";
      return `
        <div class="contact-card">
          <div class="contact-card__name">${c.name}</div>
          <div class="contact-card__role">${c.role}</div>
          ${linkHtml}
        </div>`;
    }
    const digits = c.phone.replace(/\s+/g, "");
    const isMobile = /^\+33[67]/.test(digits);
    const waLink = isMobile
      ? `<a class="contact-card__wa" href="https://wa.me/${digits.replace("+", "")}" target="_blank" rel="noopener">WhatsApp</a>`
      : "";
    return `
      <div class="contact-card">
        <div class="contact-card__name">${c.name}</div>
        <div class="contact-card__role">${c.role}</div>
        <div class="contact-card__links">
          <a class="contact-card__phone" href="tel:${digits}">${c.phone}</a>
          ${waLink}
        </div>
      </div>`;
  }).join("");
})();

// ---- Map embed ----
(function map() {
  const frame = document.getElementById("map-frame");
  const link = document.getElementById("map-link");
  if (frame) frame.src = CONFIG.MAP_EMBED_URL;
  if (link) link.href = CONFIG.MAP_LINK_URL;
})();

// ---- Photo lightbox / slideshow ----
(function lightbox() {
  const images = Array.from(document.querySelectorAll(".photo-gallery img"));
  if (!images.length) return;

  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const counter = document.getElementById("lightbox-counter");
  let index = 0;

  function show(i) {
    index = (i + images.length) % images.length;
    lbImg.src = images[index].src;
    lbImg.alt = images[index].alt;
    counter.textContent = `${index + 1} / ${images.length}`;
  }
  function open(i) {
    show(i);
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function close() {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  images.forEach((img, i) => img.addEventListener("click", () => open(i)));
  document.getElementById("lightbox-close").addEventListener("click", close);
  document.getElementById("lightbox-prev").addEventListener("click", () => show(index - 1));
  document.getElementById("lightbox-next").addEventListener("click", () => show(index + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
})();

// ---- Scoreboard: Aria Alto vs Aria Terra (local to this device) ----
(function scoreboard() {
  const alto = document.getElementById("score-alto");
  const terra = document.getElementById("score-terra");
  if (!alto || !terra) return;

  function load(key) {
    return parseInt(localStorage.getItem(key) || "0", 10);
  }
  function set(key, el, val) {
    localStorage.setItem(key, String(val));
    el.textContent = val;
  }

  let altoScore = load("score-alto");
  let terraScore = load("score-terra");
  alto.textContent = altoScore;
  terra.textContent = terraScore;

  document.getElementById("score-alto-plus").addEventListener("click", () => set("score-alto", alto, ++altoScore));
  document.getElementById("score-alto-minus").addEventListener("click", () => set("score-alto", alto, Math.max(0, --altoScore)));
  document.getElementById("score-terra-plus").addEventListener("click", () => set("score-terra", terra, ++terraScore));
  document.getElementById("score-terra-minus").addEventListener("click", () => set("score-terra", terra, Math.max(0, --terraScore)));
})();

// ---- Scrollspy: highlight the current section in the top nav ----
(function scrollspy() {
  const links = Array.from(document.querySelectorAll(".topnav__links a"));
  if (!links.length) return;

  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!sections.length) return;

  function setActive(id) {
    links.forEach((link) => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      if (active) link.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
})();

// ---- Back to top ----
(function backToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("is-visible", window.scrollY > 800);
  });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
})();

