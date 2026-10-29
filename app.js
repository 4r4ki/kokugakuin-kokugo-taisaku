(function () {
  "use strict";

  const app = document.getElementById("app");
  const LABELS = { kana: "アイウエオカキクケコ", num: "1234567890", alpha: "ABCDEFGHIJ" };
  const KANJI_NUM = ["", "一", "二", "三"];
  const STORE_KEY = "kokugo-taisaku-stats";

  // ── 問題の準備 ─────────────────────────────
  // すべての問題を { q, passage, source } の形にそろえ、idで引けるようにする
  const all = {};
  const d1 = [];
  const d3Sets = [];
  const testSets = [];
  const kakoSets = [];

  (window.ORIGINAL_D1 || []).forEach(q => {
    const item = { q, source: "オリジナル" };
    all[q.id] = item;
    d1.push(item);
  });

  (window.ORIGINAL_D3 || []).forEach(p => {
    const items = p.questions.map(q => {
      const item = { q, passage: p, source: "オリジナル（" + p.title + "）" };
      all[q.id] = item;
      return item;
    });
    d3Sets.push({ p, items });
  });

  (window.TEST_D3 || []).forEach(p => {
    const items = p.questions.map(q => {
      const item = { q, passage: p, source: "本番形式（" + p.title + "）" };
      all[q.id] = item;
      return item;
    });
    testSets.push({ p, items });
  });

  (window.KAKOMON || []).forEach(set => {
    const name = set.year + "年度 第" + set.round + "回 大問" + KANJI_NUM[set.daimon];
    const passage = set.passage ? { title: set.passageTitle, author: set.passageAuthor, passage: set.passage, notes: set.notes } : null;
    const items = set.questions.map(q => {
      q.id = q.id || set.id + "-" + q.n;
      const item = { q, passage, source: "過去問 " + name + " " + q.n };
      all[q.id] = item;
      return item;
    });
    kakoSets.push({ set, name, items });
  });

  // ── 記録（このブラウザの中にだけ保存） ─────────
  function loadStats() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStats(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* 保存できなくても動く */ }
  }
  function record(id, ok) {
    const s = loadStats();
    const r = s[id] || { c: 0, w: 0 };
    if (ok) r.c++; else r.w++;
    r.last = ok;
    s[id] = r;
    saveStats(s);
  }

  // ── 小道具 ───────────────────────────────
  function esc(str) {
    return String(str).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function lab(obj, i) { return LABELS[obj.labels || "kana"][i]; }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function normalize(s) {
    return String(s)
      .replace(/[\s　。、]/g, "")
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function rateOf(items, stats) {
    let c = 0, w = 0;
    items.forEach(it => { const r = stats[it.q.id]; if (r) { c += r.c; w += r.w; } });
    return { c, w, pct: c + w ? Math.round((c / (c + w)) * 100) : null };
  }
  function rateHtml(r) {
    if (r.pct === null) return '<span class="rate">まだ解いていません</span>';
    return '<span class="rate">正答率 ' + r.pct + "%（" + (r.c + r.w) + "回）" +
      '<div class="bar"><span style="width:' + r.pct + '%"></span></div></span>';
  }

  // 画面上部の「問題を解く／知識を学ぶ」切りかえ
  function tabs(active) {
    const bar = el('<nav class="tabs"><button type="button">問題を解く</button><button type="button">知識を学ぶ</button></nav>');
    const [b1, b2] = bar.querySelectorAll("button");
    b1.classList.toggle("on", active === "quiz");
    b2.classList.toggle("on", active === "learn");
    b1.onclick = home;
    b2.onclick = learnHome;
    return bar;
  }

  // ── ホーム画面 ─────────────────────────────
  function home() {
    const stats = loadStats();
    const cats = [];
    d1.forEach(it => { if (!cats.includes(it.q.cat)) cats.push(it.q.cat); });
    const wrongIds = Object.keys(stats).filter(id => stats[id].last === false && all[id]);

    app.innerHTML = "";
    app.appendChild(tabs("quiz"));

    const c1 = el('<section class="card"><h2>大問1　知識問題</h2>' +
      '<p class="muted">漢字・部首・熟語・慣用句・敬語・文法など。本番は12問です。</p></section>');
    const testBtn = el('<button class="btn" type="button">本番形式 12問テスト</button>');
    testBtn.onclick = () => start("大問1 12問テスト", pickTest());
    c1.appendChild(testBtn);
    c1.appendChild(el("<h3>分野べつに練習</h3>"));
    const ul = el('<ul class="list"></ul>');
    cats.forEach(cat => {
      const items = d1.filter(it => it.q.cat === cat);
      const li = el("<li><div><button class=\"btn sub\" type=\"button\">" + esc(cat) + "（" + items.length + "問）</button></div>" + rateHtml(rateOf(items, stats)) + "</li>");
      li.querySelector("button").onclick = () => start("大問1 " + cat, shuffle(items));
      ul.appendChild(li);
    });
    c1.appendChild(ul);
    app.appendChild(c1);

    const c3 = el('<section class="card"><h2>大問3　詩・短歌</h2>' +
      '<p class="muted">表現技法（比喩・擬人法・倒置法・体言止め・反復）、句切れ、気持ちの読み取り。</p></section>');
    c3.appendChild(el("<h3>本番形式テスト</h3>"));
    c3.appendChild(el('<p class="muted">本番と同じく、作品一つに問一から答えます。第1回は詩、第2回は短歌・俳句が出ます。</p>'));
    const ult = el('<ul class="list"></ul>');
    testSets.forEach(({ p, items }) => {
      const li = el("<li><div><button class=\"btn\" type=\"button\">" + esc(p.label) + "</button>" +
        ' <span class="muted">' + esc(p.title) + (p.author ? "（" + esc(p.author) + "）" : "") + "・" + items.length + "問</span></div>" +
        rateHtml(rateOf(items, stats)) + "</li>");
      li.querySelector("button").onclick = () => start("大問3 " + p.label, items);
      ult.appendChild(li);
    });
    c3.appendChild(ult);
    c3.appendChild(el("<h3>作品べつに練習</h3>"));
    const ul3 = el('<ul class="list"></ul>');
    d3Sets.forEach(({ p, items }) => {
      const li = el("<li><div><button class=\"btn sub\" type=\"button\">" + esc(p.title) + "</button>" +
        (p.author ? ' <span class="muted">' + esc(p.author) + "</span>" : "") + "</div>" + rateHtml(rateOf(items, stats)) + "</li>");
      li.querySelector("button").onclick = () => start("大問3 " + p.title, items);
      ul3.appendChild(li);
    });
    c3.appendChild(ul3);
    app.appendChild(c3);

    const ck = el('<section class="card"><h2>過去問</h2></section>');
    if (!kakoSets.length) {
      ck.appendChild(el('<p class="muted">過去問は著作物のため、このページには入っていません。パソコンの <code>index.html</code> から開いたときだけ使えます。</p>'));
    } else {
      ck.appendChild(el('<p class="notice">解答は問題集の解答ページで確認ずみです。解説はこのアプリ用に書いたものです。</p>'));
      const ulk = el('<ul class="list"></ul>');
      kakoSets.slice().sort((a, b) => (b.set.year - a.set.year) || (a.set.round - b.set.round) || (a.set.daimon - b.set.daimon))
        .forEach(({ set, name, items }) => {
          const li = el("<li><div><button class=\"btn sub\" type=\"button\">" + esc(name) + "</button>" +
            (set.partial ? ' <span class="muted">（一部）</span>' : "") + "</div>" + rateHtml(rateOf(items, stats)) + "</li>");
          li.querySelector("button").onclick = () => start(name, items, set.note);
          ulk.appendChild(li);
        });
      ck.appendChild(ulk);
    }
    app.appendChild(ck);

    const cw = el('<section class="card"><h2>まちがえた問題の復習</h2>' +
      '<p class="muted">最後に解いたときにまちがえた問題が ' + wrongIds.length + " 問あります。</p></section>");
    const wb = el('<button class="btn" type="button">復習する</button>');
    wb.disabled = !wrongIds.length;
    wb.onclick = () => start("まちがえた問題の復習", shuffle(wrongIds.map(id => all[id])));
    cw.appendChild(wb);
    const rb = el('<button class="btn sub" type="button">記録を消す</button>');
    rb.onclick = () => {
      if (confirm("これまでの記録（正答率・まちがえた問題）をすべて消します。よろしいですか？")) {
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 無視 */ }
        home();
      }
    };
    cw.appendChild(rb);
    cw.appendChild(el('<p class="muted">記録はこの端末のブラウザの中にだけ保存されます。</p>'));
    app.appendChild(cw);
    window.scrollTo(0, 0);
  }

  // 本番形式：分野がかたよらないように12問選ぶ
  function pickTest() {
    const byCat = {};
    shuffle(d1).forEach(it => { (byCat[it.q.cat] = byCat[it.q.cat] || []).push(it); });
    const picked = [];
    const cats = shuffle(Object.keys(byCat));
    while (picked.length < 12 && cats.some(c => byCat[c].length)) {
      cats.forEach(c => { if (picked.length < 12 && byCat[c].length) picked.push(byCat[c].shift()); });
    }
    return picked;
  }

  // ── 知識を学ぶ ─────────────────────────────
  const LEARN = window.LEARN || [];

  function cardsOf(t) {
    const cards = [];
    t.sections.forEach(s => { if (s.card !== false) s.items.forEach(([f, b]) => cards.push({ f, b, h: s.h })); });
    return cards;
  }

  // テーマに関係する問題（大問1は本文なし、大問3は本文ありの問題から選ぶ）
  function itemsOf(t) {
    return Object.values(all).filter(it => t.cats.includes(it.q.cat) && (t.group === 3) === !!it.passage);
  }

  function learnHome() {
    app.innerHTML = "";
    app.appendChild(tabs("learn"));
    [[1, "大問1　知識問題"], [3, "大問3　詩・短歌・俳句"]].forEach(([g, h]) => {
      const c = el('<section class="card"><h2>' + h + '</h2></section>');
      const ul = el('<ul class="list"></ul>');
      LEARN.filter(t => t.group === g).forEach(t => {
        const li = el('<li><div><button class="btn sub" type="button">' + esc(t.title) + '</button></div>' +
          '<span class="rate">' + (cardsOf(t).length ? "カード " + cardsOf(t).length + "枚・" : "") + "問題 " + itemsOf(t).length + "問</span></li>");
        li.querySelector("button").onclick = () => topicPage(t);
        ul.appendChild(li);
      });
      c.appendChild(ul);
      app.appendChild(c);
    });
    window.scrollTo(0, 0);
  }

  function topicPage(t) {
    app.innerHTML = "";
    app.appendChild(tabs("learn"));
    const c = el('<section class="card learn"><h2>' + esc(t.title) + '</h2><p>' + esc(t.intro) + "</p></section>");
    const actions = el('<div class="actions"></div>');
    const cards = cardsOf(t);
    const items = itemsOf(t);
    if (cards.length) {
      const cb = el('<button class="btn" type="button">暗記カード（' + cards.length + "枚）</button>");
      cb.onclick = () => flashcards(t, shuffle(cards));
      actions.appendChild(cb);
    }
    if (items.length) {
      const qb = el('<button class="btn sub" type="button">このテーマの問題を解く</button>');
      qb.onclick = () => start(t.title + "の練習", shuffle(items).slice(0, 15));
      actions.appendChild(qb);
    }
    c.appendChild(actions);

    t.sections.forEach(s => {
      c.appendChild(el("<h3>" + esc(s.h) + "</h3>"));
      c.appendChild(el('<dl class="terms">' + s.items.map(([a, b]) => "<dt>" + esc(a) + "</dt><dd>" + esc(b) + "</dd>").join("") + "</dl>"));
    });

    const back = el('<button class="btn sub" type="button">テーマの一覧へ</button>');
    back.onclick = learnHome;
    c.appendChild(back);
    app.appendChild(c);
    window.scrollTo(0, 0);
  }

  // 暗記カード：表を見て思い出し、めくって確かめる
  function flashcards(t, deck) {
    let i = 0;
    const again = [];
    function show() {
      app.innerHTML = "";
      app.appendChild(tabs("learn"));
      const c = el('<section class="card"></section>');
      if (i >= deck.length) {
        c.appendChild(el("<h2>" + esc(t.title) + "　暗記カード</h2>"));
        c.appendChild(el('<p>' + deck.length + "枚中 " + (deck.length - again.length) + "枚を覚えました。</p>"));
        if (again.length) {
          const r = el('<button class="btn" type="button">覚えていない ' + again.length + "枚をもう一度</button>");
          r.onclick = () => flashcards(t, shuffle(again));
          c.appendChild(r);
        }
        const b = el('<button class="btn sub" type="button">「' + esc(t.title) + "」にもどる</button>");
        b.onclick = () => topicPage(t);
        c.appendChild(b);
        app.appendChild(c);
        return;
      }
      const card = deck[i];
      c.appendChild(el('<div class="qhead"><span class="tag">' + esc(card.h) + '</span><span class="progress">' + (i + 1) + " / " + deck.length + "</span></div>"));
      const fc = el('<div class="flash"><div class="front">' + esc(card.f) + '</div><div class="back" hidden>' + esc(card.b) + "</div></div>");
      c.appendChild(fc);
      const flip = el('<button class="btn" type="button">答えを見る</button>');
      const ok = el('<button class="btn" type="button" hidden>覚えた</button>');
      const ng = el('<button class="btn sub" type="button" hidden>まだ</button>');
      const reveal = () => { fc.querySelector(".back").hidden = false; flip.hidden = true; ok.hidden = false; ng.hidden = false; };
      flip.onclick = reveal;
      fc.onclick = reveal;
      ok.onclick = () => { i++; show(); };
      ng.onclick = () => { again.push(card); i++; show(); };
      const quit = el('<button class="btn sub" type="button">やめる</button>');
      quit.onclick = () => topicPage(t);
      [flip, ok, ng, quit].forEach(b => c.appendChild(b));
      app.appendChild(c);
      window.scrollTo(0, 0);
    }
    show();
  }

  // ── 問題を解く ─────────────────────────────
  let session = null;

  function start(title, items, note) {
    session = { title, items, note, i: 0, results: [] };
    showQuestion();
  }

  function showQuestion() {
    const item = session.items[session.i];
    const q = item.q;
    app.innerHTML = "";
    const card = el('<section class="card"></section>');

    card.appendChild(el('<div class="qhead"><span class="tag">' + esc(q.cat) + '</span><span class="tag">' + esc(item.source) +
      '</span><span class="progress">' + (session.i + 1) + " / " + session.items.length + "</span></div>"));
    if (session.i === 0 && session.note) card.appendChild(el('<p class="notice">' + esc(session.note) + "</p>"));

    if (item.passage) card.appendChild(passageBox(item.passage));

    card.appendChild(el('<div class="qtext">' + (q.n ? esc(q.n) + "　" : "") + q.q + "</div>"));
    if (q.items) card.appendChild(el('<div class="items">' + q.items.map(s => "<div>" + s + "</div>").join("") + "</div>"));

    const area = el("<div></div>");
    card.appendChild(area);
    const getAnswer = buildInput(q, area);

    const fb = el("<div></div>");
    card.appendChild(fb);
    const checkBtn = el('<button class="btn" type="button">答え合わせ</button>');
    card.appendChild(checkBtn);
    const quitBtn = el('<button class="btn sub" type="button">やめる</button>');
    quitBtn.onclick = () => (session.results.length ? showResult() : home());
    card.appendChild(quitBtn);

    checkBtn.onclick = () => {
      checkBtn.remove();
      quitBtn.remove();
      if (q.type === "self") {
        selfGrade(q, fb, card);
      } else {
        const ok = getAnswer.check();
        finish(ok, q, fb, card);
      }
    };
    app.appendChild(card);
    window.scrollTo(0, 0);
  }

  function passageBox(p) {
    const box = el('<div class="passage"></div>');
    if (p.title) box.appendChild(el('<div class="ptitle">' + esc(p.title) + (p.author ? '　<span class="muted">' + esc(p.author) + "</span>" : "") + "</div>"));
    // ［①……］は——線部①として線を引く
    const v = el('<div class="vert">' + esc(p.passage).replace(/［([①-⑳]?)([^］]+)］/g, '$1<span class="bo">$2</span>') + "</div>");
    const hint = el('<div class="hint" hidden>← 本文は横にスクロールできます（続きは左）</div>');
    box.appendChild(v);
    box.appendChild(hint);
    // 画面に表示されてから、本文が枠に入りきっているかを調べる
    requestAnimationFrame(() => { hint.hidden = v.scrollWidth <= v.clientWidth + 2; });
    if (p.notes) box.appendChild(el('<div class="notes">' + p.notes.map(esc).join("<br>") + "</div>"));
    return box;
  }

  // 問題の形式ごとに入力欄を作り、check() で正誤を返す
  function buildInput(q, area) {
    if (q.type === "choice") return choiceInput(q, area);
    if (q.type === "multi") return multiInput(q, area);
    if (q.type === "order") return orderInput(q, area);
    if (q.type === "text") return textInput(q, area);
    if (q.type === "parts") {
      const parts = q.parts.map(p => {
        const wrap = el('<div class="part"><span class="plabel">' + esc(p.label) + "</span></div>");
        area.appendChild(wrap);
        const inp = p.type === "choice" ? choiceInput(p, wrap) : textInput(p, wrap);
        return { wrap, inp };
      });
      return {
        check() {
          let all = true;
          parts.forEach(({ wrap, inp }) => {
            const ok = inp.check();
            wrap.classList.add(ok ? "ok" : "ng");
            if (!ok) all = false;
          });
          return all;
        }
      };
    }
    return { check: () => false };
  }

  function choiceInput(q, area) {
    let sel = -1;
    const box = el('<div class="choices"></div>');
    const btns = q.choices.map((c, i) => {
      const b = el('<button class="choice" type="button"><span class="lab">' + lab(q, i) + "</span><span>" + c + "</span></button>");
      b.onclick = () => { sel = i; btns.forEach((x, j) => x.classList.toggle("selected", j === i)); };
      box.appendChild(b);
      return b;
    });
    area.appendChild(box);
    return {
      check() {
        btns.forEach((b, i) => {
          b.disabled = true;
          b.classList.remove("selected");
          if (i === q.answer) b.classList.add("correct");
          else if (i === sel) b.classList.add("wrong");
        });
        return sel === q.answer;
      },
      answerText: () => lab(q, q.answer)
    };
  }

  function multiInput(q, area) {
    const sel = new Set();
    area.appendChild(el('<p class="muted">あてはまるものをすべて選んでください。</p>'));
    const box = el('<div class="choices"></div>');
    const btns = q.choices.map((c, i) => {
      const b = el('<button class="choice" type="button"><span class="lab">' + lab(q, i) + "</span><span>" + c + "</span></button>");
      b.onclick = () => { sel.has(i) ? sel.delete(i) : sel.add(i); b.classList.toggle("selected", sel.has(i)); };
      box.appendChild(b);
      return b;
    });
    area.appendChild(box);
    return {
      check() {
        btns.forEach((b, i) => {
          b.disabled = true;
          b.classList.remove("selected");
          if (q.answer.includes(i)) b.classList.add("correct");
          else if (sel.has(i)) b.classList.add("wrong");
        });
        return sel.size === q.answer.length && q.answer.every(i => sel.has(i));
      }
    };
  }

  function orderInput(q, area) {
    let seq = [];
    area.appendChild(el('<p class="muted">はじめにくるものから順にタップしてください。</p>'));
    const seqBox = el('<div class="seq"></div>');
    const box = el('<div class="choices"></div>');
    const btns = q.choices.map((c, i) => {
      const b = el('<button class="choice" type="button"><span class="lab">' + lab(q, i) + "</span><span>" + c + "</span></button>");
      b.onclick = () => { if (!seq.includes(i)) { seq.push(i); update(); } };
      box.appendChild(b);
      return b;
    });
    const reset = el('<button class="btn sub" type="button">やり直す</button>');
    reset.onclick = () => { seq = []; update(); };
    function update() {
      seqBox.textContent = seq.map(i => lab(q, i)).join(" → ");
      btns.forEach((b, i) => b.classList.toggle("selected", seq.includes(i)));
    }
    area.appendChild(box);
    area.appendChild(seqBox);
    area.appendChild(reset);
    return {
      check() {
        btns.forEach(b => { b.disabled = true; });
        reset.remove();
        return seq.length === q.answer.length && q.answer.every((v, i) => seq[i] === v);
      }
    };
  }

  function textInput(q, area) {
    // autocomplete="off" があると、iPhoneで漢字の変換候補が出なくなるので付けない
    const inp = el('<input class="textin" type="text" lang="ja" autocorrect="on" placeholder="ここに書く">');
    area.appendChild(inp);
    return {
      check() {
        inp.disabled = true;
        return q.accept.map(normalize).includes(normalize(inp.value));
      }
    };
  }

  function answerText(q) {
    if (q.type === "choice") return lab(q, q.answer);
    if (q.type === "multi") return q.answer.map(i => lab(q, i)).join("・");
    if (q.type === "order") return q.answer.map(i => lab(q, i)).join(" → ");
    if (q.type === "text") return q.accept[0] + (q.accept.length > 1 ? "（ほかに " + q.accept.slice(1, 4).join("・") + " なども正解）" : "");
    if (q.type === "parts") {
      return q.parts.map(p => p.label + "：" + (p.type === "choice" ? lab(p, p.answer) : p.accept[0])).join("　");
    }
    return "";
  }

  function selfGrade(q, fb, card) {
    fb.className = "feedback";
    fb.innerHTML = '<div class="ans"><b>答えの例</b>　' + esc(q.model) + "</div>" +
      (q.points ? '<div class="ans"><b>チェックポイント</b><br>' + q.points.map(p => "・" + esc(p)).join("<br>") + "</div>" : "") +
      '<p class="muted">自分の答えと比べて、丸をつけてください。</p>';
    const okBtn = el('<button class="btn" type="button">できた（○）</button>');
    const ngBtn = el('<button class="btn sub" type="button">まちがえた（×）</button>');
    okBtn.onclick = () => { okBtn.remove(); ngBtn.remove(); finish(true, q, fb, card); };
    ngBtn.onclick = () => { okBtn.remove(); ngBtn.remove(); finish(false, q, fb, card); };
    card.appendChild(okBtn);
    card.appendChild(ngBtn);
  }

  function finish(ok, q, fb, card) {
    record(q.id, ok);
    session.results.push(ok);
    fb.className = "feedback " + (ok ? "ok" : "ng");
    fb.innerHTML = '<div class="mark">' + (ok ? "○ 正解！" : "× ざんねん") + "</div>" +
      (q.type !== "self" ? '<div class="ans"><b>正解</b>　' + esc(answerText(q)) + "</div>" : "") +
      (q.explain ? '<div class="ans">' + esc(q.explain) + "</div>" : "");
    const last = session.i === session.items.length - 1;
    const next = el('<button class="btn" type="button">' + (last ? "結果を見る" : "次の問題へ") + "</button>");
    next.onclick = () => { if (last) showResult(); else { session.i++; showQuestion(); } };
    card.appendChild(next);
    next.focus();
  }

  // ── 結果 ─────────────────────────────────
  function showResult() {
    const n = session.results.length;
    const okCount = session.results.filter(Boolean).length;
    const wrongItems = session.items.filter((_, i) => session.results[i] === false);
    app.innerHTML = "";
    const card = el('<section class="card"><h2>' + esc(session.title) + "　結果</h2>" +
      '<div class="score">' + okCount + " / " + n + "</div></section>");

    session.items.slice(0, n).forEach((it, i) => {
      const ok = session.results[i];
      card.appendChild(el('<div class="result-row"><span class="m ' + (ok ? "ok" : "ng") + '">' + (ok ? "○" : "×") + "</span>" +
        '<span class="muted">' + esc(it.q.cat) + "</span>　" + it.q.q +
        (ok ? "" : '<div class="muted">正解：' + esc(answerText(it.q) || it.q.model || "") + "</div>") + "</div>"));
    });

    if (wrongItems.length) {
      const again = el('<button class="btn" type="button">まちがえた問題をもう一度</button>');
      again.onclick = () => start(session.title + "（やり直し）", wrongItems);
      card.appendChild(again);
    }
    const back = el('<button class="btn sub" type="button">はじめの画面へ</button>');
    back.onclick = home;
    card.appendChild(back);
    app.appendChild(card);
    window.scrollTo(0, 0);
  }

  document.getElementById("homeBtn").onclick = home;
  home();
})();
