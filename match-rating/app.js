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

  // 最大7名まで表示・計算対象とする
  members = members.slice(0, 7);

  // 「初」の表示用仮レイティング＝参加者内の最低点
  const numericRatings = members
    .map(m => Number(m.rating))
    .filter(n => Number.isFinite(n));

  const minRating = numericRatings.length
    ? Math.min(...numericRatings)
    : 0;

  $("members").innerHTML =
    members.length
      ? table(
          members.map((m, i) => ({
            番号: i + 1,
            会員番号: m.id,
            氏名: m.name,

            レイティング:
              m.rating === "初"
                ? `初(${minRating})`
                : m.rating
          })),

          ["番号", "会員番号", "氏名", "レイティング"]

        ) + `

          <div
            style="
              text-align:center;
              margin-top:12px;
            "
          >

            <button
              id="showGraph"
              class="btn"
            >
              グラフ表示する
            </button>

          </div>

          <div
            id="leagueGraph"
            style="margin-top:16px"
          ></div>

        `

      : "<p>参加者を抽出できませんでした。</p>";


  // グラフ表示ボタン
  const graphButton = $("showGraph");

  if (graphButton) {
    graphButton.onclick = renderLeagueGraph;
  }


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
// 現在のレイティング比較グラフ
// 最大7名
// --------------------------------------------------

function renderLeagueGraph() {

  const target = $("leagueGraph");

  if (!target) return;


  // 最大7名
  const list = members.slice(0, 7);


  if (!list.length) {

    target.innerHTML =
      "<p>表示する参加者がいません。</p>";

    return;
  }


  // 数値レイティングだけを抽出
  const numericRatings = list
    .map(m => Number(m.rating))
    .filter(n => Number.isFinite(n));


  // 「初」の仮レイティング
  const minRating = numericRatings.length
    ? Math.min(...numericRatings)
    : 0;


  // 実際にグラフで使用するレイティング
  const getRating = m =>

    m.rating === "初" ||
    !Number.isFinite(Number(m.rating))

      ? minRating

      : Number(m.rating);


  const values =
    list.map(getRating);


  const width =
    Math.max(
      620,
      target.clientWidth || 620
    );


  const height = 360;


  const padding = {
    top: 35,
    right: 20,
    bottom: 70,
    left: 55
  };


  const chartW =
    width -
    padding.left -
    padding.right;


  const chartH =
    height -
    padding.top -
    padding.bottom;


  const min =
    Math.min(...values);


  const max =
    Math.max(...values);


  const range =
    Math.max(
      100,
      max - min
    );


  const yMin =
    Math.floor(
      (min - range * 0.15) / 50
    ) * 50;


  const yMax =
    Math.ceil(
      (max + range * 0.15) / 50
    ) * 50;


  const x = i =>

    padding.left +

    (
      list.length === 1

        ? chartW / 2

        : chartW *
          i /
          (list.length - 1)
    );


  const y = value =>

    padding.top +
    chartH -

    (
      (value - yMin) /
      (yMax - yMin)
    ) *
    chartH;


  const points = list

    .map(
      (m, i) =>
        `${x(i)},${y(getRating(m))}`
    )

    .join(" ");


  // 横方向のグリッド
  const grid =

    Array.from(
      { length: 6 },
      (_, i) => {

        const value =
          yMin +
          (yMax - yMin) *
          i /
          5;


        const yy =
          y(value);


        return `

          <line
            x1="${padding.left}"
            y1="${yy}"
            x2="${width - padding.right}"
            y2="${yy}"
            stroke="#d1d5db"
            stroke-width="1"
          />


          <text
            x="${padding.left - 8}"
            y="${yy + 4}"
            text-anchor="end"
            font-size="12"
            fill="#555"
          >
            ${Math.round(value)}
          </text>

        `;
      }
    )
    .join("");


  // 選手名とポイント
  const labels =

    list

      .map(
        (m, i) => `

          <circle
            cx="${x(i)}"
            cy="${y(getRating(m))}"
            r="4"
            fill="currentColor"
          />


          <text
            x="${x(i)}"
            y="${height - 38}"
            text-anchor="middle"
            font-size="12"
            fill="#333"
          >
            ${esc(m.name)}
          </text>

        `
      )

      .join("");


  target.innerHTML = `

    <div class="card">

      <h3
        style="
          text-align:center;
        "
      >
        現在のレイティング比較
      </h3>


      <div
        style="
          width:100%;
          overflow-x:auto;
        "
      >

        <svg
          viewBox="0 0 ${width} ${height}"
          width="100%"
          height="${height}"
          role="img"
          aria-label="参加者の現在のレイティング比較グラフ"
        >

          ${grid}


          <polyline
            points="${points}"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />


          ${labels}

        </svg>

      </div>

    </div>

  `;
}


// --------------------------------------------------
// 対戦相手表示
// 「勝」「負」のどちらかを選択
// --------------------------------------------------

function renderOpponents() {

  const t =
    Number(
      $("target").value || 0
    );


  $("opponents").innerHTML =

    members

      .filter(
        (_, i) =>
          i !== t
      )

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

              <strong>
                ${esc(m.name)}
              </strong>

              (${m.id})

              / レイティング ${m.rating}

            </div>


            <div
              style="
                margin-top:6px;
              "
            >


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

function calculate() {

  // ------------------------------------------------
  // 1.
  // 数値レイティングの中から最低値を取得
  // 「初」の仮レイティングとして使用
  // ------------------------------------------------

  const validRatings = members

    .map(
      m =>
        Number(m.rating)
    )

    .filter(
      n =>
        !isNaN(n)
    );


  const minRating =
    validRatings.length

      ? Math.min(
          ...validRatings
        )

      : 0;


  // ------------------------------------------------
  // 2.
  // 「初」の選手は最低値を使用
  // ------------------------------------------------

  const getRating = m =>

    m.rating === "初" ||
    isNaN(
      Number(m.rating)
    )

      ? minRating

      : Number(
          m.rating
        );


  const t =
    Number(
      $("target").value
    );


  // 基準選手のレイティング
  const base =
    getRating(
      members[t]
    );


  const selections = [

    ...document.querySelectorAll(
      ".opp-result:checked"
    )

  ];


  let total = 0;

  const rows = [];


  // ------------------------------------------------
  // 3.
  // 選択された相手ごとに計算
  // ------------------------------------------------

  for (
    const input of selections
  ) {

    const [
      idxText,
      result
    ] =
      input.value.split(":");


    const i =
      Number(idxText);


    // 相手のレイティング
    const r =
      getRating(
        members[i]
      );


    // レイティング差
    const diff =
      Math.abs(
        base - r
      );


    // ポイント表から該当するものを取得
    const rec =
      POINTS.find(
        x =>
          diff <= x[0]
      )
      ||
      POINTS.at(-1);


    // ------------------------------------------------
    // 自分が格下かどうか
    // ------------------------------------------------

    const isLower =
      base < r;


    let change = 0;


    // ------------------------------------------------
    // 勝った場合
    //
    // 自分が格下
    // → 大きく増える
    //
    // 自分が格上
    // → 小さく増える
    // ------------------------------------------------

    if (
      result === "win"
    ) {

      change =
        isLower
          ? rec[2]
          : rec[1];

    }


    // ------------------------------------------------
    // 負けた場合
    //
    // 自分が格下
    // → 小さく減る
    //
    // 自分が格上
    // → 大きく減る
    // ------------------------------------------------

    else {

      change =
        -(
          isLower
            ? rec[1]
            : rec[2]
        );

    }


    total +=
      change;


    rows.push({

      相手:
        members[i].name,


      相手レイティング:

        members[i].rating === "初"

          ? `初(${minRating})`

          : members[i].rating,


      差:
        diff,


      勝敗:

        result === "win"

          ? "勝"

          : "負",


      増減:

        (change >= 0
          ? "+"
          : "") +
        change

    });

  }


  // ------------------------------------------------
  // 4.
  // 最終結果
  // ------------------------------------------------

  const estimated =
    base +
    total;


  const totalText =
    (total >= 0
      ? "+"
      : "") +
    total;


  // ------------------------------------------------
  // 5.
  // 結果表示
  // ------------------------------------------------

  $("calcResult").innerHTML = `

    <p>

      基準選手：

      ${esc(
        members[t].name
      )}

      /

      現在

      ${
        members[t].rating === "初"

          ? `初(${minRating})`

          : members[t].rating
      }

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

            対戦相手の
            「勝」または「負」を
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

          増減：
          ${totalText}

          ・

          結果：
          ${estimated}

        </strong>

      </p>

    </div>

  `;
}


// --------------------------------------------------
// 表作成
// --------------------------------------------------

function table(
  rows,
  cols
) {

  return `

    <div
      class="table-wrap"
    >

      <table>

        <thead>

          <tr>

            ${cols

              .map(
                c =>
                  `<th>
                    ${esc(c)}
                  </th>`
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

                        `<td>
                          ${esc(
                            r[c] ?? ""
                          )}
                        </td>`

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

function parseCSV(
  text
) {

  const rows = [];


  let row = [];

  let cell = "";

  let q = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const c =
      text[i];


    const n =
      text[i + 1];


    if (
      c === '"' &&
      q &&
      n === '"'
    ) {

      cell += '"';

      i++;

      continue;
    }


    if (
      c === '"'
    ) {

      q =
        !q;

      continue;
    }


    if (
      c === "," &&
      !q
    ) {

      row.push(
        cell
      );

      cell =
        "";

      continue;
    }


    if (
      (
        c === "\n" ||
        c === "\r"
      ) &&
      !q
    ) {

      if (
        c === "\r" &&
        n === "\n"
      ) {

        i++;

      }


      row.push(
        cell
      );

      cell =
        "";


      if (
        row.some(
          x =>
            x.trim()
        )
      ) {

        rows.push(
          row
        );

      }


      row =
        [];


      continue;
    }


    cell +=
      c;

  }


  if (
    cell ||
    row.length
  ) {

    row.push(
      cell
    );

    rows.push(
      row
    );

  }


  const h =
    rows
      .shift()
      .map(
        x =>
          x.trim()
      );


  return rows.map(
    r =>

      Object.fromEntries(

        h.map(
          (k, i) =>

            [
              k,
              (
                r[i] ??
                ""
              ).trim()
            ]

        )

      )

  );

}


// --------------------------------------------------
// HTMLエスケープ
// --------------------------------------------------

function esc(
  s
) {

  return String(
    s
  ).replace(
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
