let members = [];

const $ = id => document.getElementById(id);

// レイティング差 → 勝ち増加 / 負け減少
const POINTS = [
  [12, 8, 8],
  [37, 7, 10],
  [62, 6, 13],
  [87, 5, 16],
  [112, 4, 20],
  [137, 3, 25],
  [162, 2, 30],
  [187, 2, 35],
  [212, 1, 40],
  [237, 1, 45],
  [99999, 0, 50]
];

document.addEventListener("DOMContentLoaded", () => {
  $("confirm").onclick = confirmText;
  $("calc").onclick = calculate;
  loadRatingData();
});


// --------------------------------------------------
// 最新日取得
// --------------------------------------------------

async function loadRatingData() {
  try {
    const r = await fetch("../data/rating_data_all.csv", {
      cache: "no-store"
    });

    if (!r.ok) {
      throw Error(`HTTP ${r.status}`);
    }

    const t = await r.text();
    const rows = parseCSV(t);

    const dates = rows
      .map(x => new Date(String(x["日付"] || "").replaceAll("/", "-")))
      .filter(x => !isNaN(x));

    if (dates.length) {
      dates.sort((a, b) => a - b);

      $("lastUpdated").textContent =
        "最終更新日：" +
        dates.at(-1).toISOString().slice(0, 10);
    }

  } catch (e) {
    $("lastUpdated").textContent =
      "最終更新日：取得できません";
  }
}


// --------------------------------------------------
// 会員番号解析
// --------------------------------------------------

function parseCandidateNumber(s) {

  s = String(s).replace(/\D/g, "");

  if (s.length >= 8) {
    return Number(s.slice(-7));
  }

  if (
    s.length === 7 ||
    (s.length === 6 && s.startsWith("9"))
  ) {
    return Number(s);
  }

  return null;
}


// --------------------------------------------------
// 貼り付けデータ解析
// --------------------------------------------------

function parseText(text) {

  const lines = text
    .normalize("NFKC")
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  const out = [];
  const used = new Set();

  for (let i = 0; i < lines.length; i++) {

    if (/^\d{6,}$/.test(lines[i])) {

      const id = parseCandidateNumber(lines[i]);

      const name =
        lines[i + 1] || "不明";

      const rt =
        /^\d+$/.test(lines[i + 2] || "")
          ? Number(lines[i + 2])
          : ((lines[i + 2] || "") === "初" ? "初" : null);

      if (id && !used.has(id)) {

        out.push({
          id,
          name,
          rating: rt ?? 0
        });

        used.add(id);
      }

      i += 2;
    }
  }

  return out;
}


// --------------------------------------------------
// ペースト完了
// --------------------------------------------------

function confirmText() {

  members = parseText($("inputText").value);

  $("membersCard").classList.remove("hidden");
  $("calcCard").classList.remove("hidden");

  $("status").className = "status ok";

  $("status").textContent =
    `${members.length}名を抽出しました。`;

  $("members").innerHTML =
    members.length
      ? table(
          members.map((m, i) => ({
            番号: i + 1,
            会員番号: m.id,
            氏名: m.name,
            レイティング: m.rating
          })),
          ["番号", "会員番号", "氏名", "レイティング"]
        )
      : "<p>参加者を抽出できませんでした。</p>";

  $("target").innerHTML =
    members
      .map(
        (m, i) =>
          `<option value="${i}">
            ${i + 1}. ${esc(m.name)} (${m.id})
          </option>`
      )
      .join("");

  $("target").onchange = renderOpponents;

  renderOpponents();
}


// --------------------------------------------------
// 対戦相手表示
// 「勝」「負」のどちらかを選択
// --------------------------------------------------

function renderOpponents() {

  const t =
    Number($("target").value || 0);

  $("opponents").innerHTML =
    members
      .filter((_, i) => i !== t)
      .map(m => {

        const idx =
          members.indexOf(m);

        return `
          <div
            class="opponent-row"
            style="
              padding:8px 0;
              border-bottom:1px solid #e5e7eb;
            "
          >

            <div>
              <strong>${esc(m.name)}</strong>
              (${m.id})
              / レイティング ${m.rating}
            </div>

            <div style="margin-top:6px">

              <label
                style="
                  display:inline-block;
                  margin-right:18px;
                  font-weight:normal;
                "
              >

                <input
                  type="radio"
                  name="result-${idx}"
                  class="opp-result"
                  value="${idx}:win"
                >

                勝

              </label>


              <label
                style="
                  display:inline-block;
                  font-weight:normal;
                "
              >

                <input
                  type="radio"
                  name="result-${idx}"
                  class="opp-result"
                  value="${idx}:loss"
                >

                負

              </label>

            </div>

          </div>
        `;
      })
      .join("");
}


// --------------------------------------------------
// 勝敗予測の結果推定
// --------------------------------------------------

function calculate(){
  const t = Number($("target").value);

  // 1. 数値のレイティングの中から最小値を算出（「初」の置き換え用）
  const validRatings = members.map(m => Number(m.rating)).filter(n => !isNaN(n));
  const minRating = validRatings.length ? Math.min(...validRatings) : 0;

  // 2. 「初」の場合は最小値(minRating)を返すヘルパー関数
  const getRating = (m) => (m.rating === "初" || isNaN(Number(m.rating))) ? minRating : Number(m.rating);

  const base = getRating(members[t]);
  const checked = [...document.querySelectorAll(".opp:checked")].map(x => Number(x.value));
  let total = 0;
  const rows = [];

  for (const i of checked) {
    const r = getRating(members[i]);
    const diff = Math.abs(base - r);
    const rec = POINTS.find(x => diff <= x[0]) || POINTS.at(-1);

    // 3. 自分が格下（base < r）かどうかで増減ポイントを切り替え
    const isLower = base < r;
    const winPt = isLower ? rec[2] : rec[1];
    const losePt = isLower ? rec[1] : rec[2];

    rows.push({
      相手: members[i].name,
      相手レイティング: members[i].rating, // 表の表示上は元の表記（「初」など）を維持
      差: diff,
      勝ち: "+" + winPt,
      負け: "-" + losePt
    });
    total += winPt;
  }

  $("calcResult").innerHTML = `<p>基準選手：${esc(members[t].name)} / 現在 ${members[t].rating}</p>${table(rows,["相手","相手レイティング","差","勝ち","負け"])}<p><strong>勝った場合の増加合計：+${total}</strong></p>`;
}

  // 現在レイティング
  // ＋今回の予測増減
  const estimated =
    base + total;


  const totalText =
    (total >= 0 ? "+" : "") +
    total;


  $("calcResult").innerHTML = `

    <p>
      基準選手：
      ${esc(members[t].name)}
      /
      現在 ${base}
    </p>


    ${
      rows.length
        ? table(
            rows,
            [
              "相手",
              "相手レイティング",
              "差",
              "勝敗",
              "増減"
            ]
          )
        : `
          <p>
            対戦相手の「勝」または「負」を
            1つ以上選択してください。
          </p>
        `
    }


    <div
      class="card"
      style="
        margin-top:14px;
        text-align:center;
      "
    >

      <h3>
        勝敗予測の結果推定
      </h3>

      <p
        style="
          font-size:20px;
          margin:8px 0;
        "
      >

        <strong>
          増減：${totalText}
          ・
          結果：${estimated}
        </strong>

      </p>

    </div>
  `;
}


// --------------------------------------------------
// 表作成
// --------------------------------------------------

function table(rows, cols) {

  return `
    <div class="table-wrap">

      <table>

        <thead>

          <tr>

            ${cols
              .map(
                c => `<th>${esc(c)}</th>`
              )
              .join("")}

          </tr>

        </thead>


        <tbody>

          ${rows
            .map(
              r => `
                <tr>

                  ${cols
                    .map(
                      c =>
                        `<td>${esc(
                          r[c] ?? ""
                        )}</td>`
                    )
                    .join("")}

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}


// --------------------------------------------------
// CSV解析
// --------------------------------------------------

function parseCSV(text) {

  const rows = [];

  let row = [];
  let cell = "";
  let q = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const c = text[i];
    const n = text[i + 1];


    if (
      c === '"' &&
      q &&
      n === '"'
    ) {

      cell += '"';
      i++;

      continue;
    }


    if (c === '"') {

      q = !q;

      continue;
    }


    if (
      c === "," &&
      !q
    ) {

      row.push(cell);
      cell = "";

      continue;
    }


    if (
      (c === "\n" ||
       c === "\r") &&
      !q
    ) {

      if (
        c === "\r" &&
        n === "\n"
      ) {
        i++;
      }

      row.push(cell);
      cell = "";


      if (
        row.some(
          x => x.trim()
        )
      ) {
        rows.push(row);
      }

      row = [];

      continue;
    }


    cell += c;
  }


  if (
    cell ||
    row.length
  ) {

    row.push(cell);
    rows.push(row);
  }


  const h =
    rows
      .shift()
      .map(x => x.trim());


  return rows.map(
    r =>
      Object.fromEntries(
        h.map(
          (k, i) =>
            [
              k,
              (r[i] ?? "").trim()
            ]
        )
      )
  );
}


// --------------------------------------------------
// HTMLエスケープ
// --------------------------------------------------

function esc(s) {

  return String(s).replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
  );
}
