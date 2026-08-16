// ============================================================
// 自分のリーグ分析
// match-rating/app.js
// ============================================================

let members = [];
let ratingHistory = [];

const $ = id => document.getElementById(id);


// ============================================================
// レイティング増減表
// ============================================================

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


// ============================================================
// 初期処理
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  if ($("confirm")) {
    $("confirm").onclick = confirmText;
  }

  if ($("calc")) {
    $("calc").onclick = calculate;
  }

  loadRatingData();

});


// ============================================================
// CSV読み込み
// ============================================================

async function loadRatingData() {

  try {

    const response =
      await fetch(
        "../data/rating_data_all.csv",
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }


    const text =
      await response.text();


    ratingHistory =
      parseCSV(text);


    ratingHistory =
      ratingHistory
        .map(row => {

          const date =
            parseDate(
              row["日付"]
            );

          const memberId =
            Number(
              String(
                row["会員番号"] || ""
              ).replace(
                /\D/g,
                ""
              )
            );

          const rating =
            Number(
              String(
                row["レイティング"] || ""
              ).replace(
                /,/g,
                ""
              )
            );


          return {
            ...row,
            _date: date,
            _memberId: memberId,
            _rating: rating
          };

        })

        .filter(
          row =>
            row._date &&
            Number.isFinite(
              row._memberId
            ) &&
            Number.isFinite(
              row._rating
            )
        );


    ratingHistory.sort(
      (a, b) =>
        a._date - b._date
    );


    if (
      ratingHistory.length &&
      $("lastUpdated")
    ) {

      const last =
        ratingHistory.at(-1)._date;


      $("lastUpdated").textContent =
        "最終更新日：" +
        formatDate(last);

    }

  }

  catch (error) {

    console.error(
      "rating_data_all.csv読み込みエラー:",
      error
    );


    if ($("lastUpdated")) {

      $("lastUpdated").textContent =
        "最終更新日：取得できません";

    }

  }

}


// ============================================================
// 日付処理
// ============================================================

function parseDate(value) {

  if (!value) {
    return null;
  }


  const text =
    String(value)
      .trim()
      .replace(
        /[/.]/g,
        "-"
      );


  const match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );


  if (!match) {
    return null;
  }


  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {

    return null;

  }


  return date;

}


function formatDate(date) {

  if (!date) {
    return "";
  }


  return (
    date.getFullYear() +
    "-" +
    String(
      date.getMonth() + 1
    ).padStart(2, "0") +
    "-" +
    String(
      date.getDate()
    ).padStart(2, "0")
  );

}


// ============================================================
// 会員番号解析
// ============================================================

function parseCandidateNumber(value) {

  let s =
    String(value)
      .replace(
        /\D/g,
        ""
      );


  if (s.length >= 8) {

    return Number(
      s.slice(-7)
    );

  }


  if (
    s.length === 7 ||
    (
      s.length === 6 &&
      s.startsWith("9")
    )
  ) {

    return Number(s);

  }


  return null;

}


// ============================================================
// 貼り付けデータ解析
// ============================================================

function parseText(text) {

  const lines =
    String(text)
      .normalize("NFKC")
      .split(/\r?\n/)
      .map(
        x => x.trim()
      )
      .filter(Boolean);


  const result = [];

  const used =
    new Set();


  for (
    let i = 0;
    i < lines.length;
    i++
  ) {

    if (
      /^\d{6,}$/.test(
        lines[i]
      )
    ) {

      const id =
        parseCandidateNumber(
          lines[i]
        );


      const name =
        lines[i + 1] ||
        "不明";


      const ratingText =
        lines[i + 2] || "";


      let rating;


      if (
        /^\d+$/.test(
          ratingText
        )
      ) {

        rating =
          Number(
            ratingText
          );

      }

      else if (
        ratingText === "初"
      ) {

        rating = "初";

      }

      else {

        rating = 0;

      }


      if (
        id &&
        !used.has(id)
      ) {

        result.push({
          id,
          name,
          rating
        });


        used.add(id);

      }


      i += 2;

    }

  }


  return result;

}


// ============================================================
// 貼り付け確定
// ============================================================

function confirmText() {

  members =
    parseText(
      $("inputText").value
    );


  // 最大7名
  members =
    members.slice(0, 7);


  if ($("membersCard")) {
    $("membersCard")
      .classList
      .remove("hidden");
  }


  if ($("calcCard")) {
    $("calcCard")
      .classList
      .remove("hidden");
  }


  if ($("status")) {

    $("status").className =
      "status ok";


    $("status").textContent =
      `${members.length}名を抽出しました。`;

  }


  // ==========================================================
  // 「初」の仮レイティング
  // ==========================================================

  const numericRatings =
    members

      .map(
        m => Number(m.rating)
      )

      .filter(
        n =>
          Number.isFinite(n)
      );


  const minRating =
    numericRatings.length
      ? Math.min(
          ...numericRatings
        )
      : 0;


  // ==========================================================
  // 現在のレイティング一覧
  // ==========================================================

  if ($("members")) {

    $("members").innerHTML =

      members.length

        ? table(

            members.map(
              (m, i) => ({

                番号:
                  i + 1,

                会員番号:
                  m.id,

                氏名:
                  m.name,

                レイティング:

                  m.rating === "初"

                    ? `初(${minRating})`

                    : m.rating

              })
            ),

            [
              "番号",
              "会員番号",
              "氏名",
              "レイティング"
            ]

          )

          +

          `

          <div
            style="
              text-align:center;
              margin-top:14px;
            "
          >

            <div
              style="
                display:flex;
                justify-content:center;
                align-items:center;
                gap:8px;
                flex-wrap:wrap;
                margin-bottom:10px;
              "
            >

              <label>
                開始年
                <select
                  id="graphStartYear"
                  class="year-select"
                ></select>
              </label>


              <label>
                終了年
                <select
                  id="graphEndYear"
                  class="year-select"
                ></select>
              </label>

            </div>


            <button
              id="showGraph"
              class="btn"
            >
              グラフ表示する
            </button>

          </div>


          <div
            id="leagueGraph"
            style="
              margin-top:16px;
            "
          ></div>

          `

        :

          "<p>参加者を抽出できませんでした。</p>";

  }


  // ==========================================================
  // グラフ年選択
  // ==========================================================

  setupGraphYears();


  // ==========================================================
  // グラフボタン
  // ==========================================================

  const graphButton =
    $("showGraph");


  if (graphButton) {

    graphButton.onclick =
      renderLeagueGraph;

  }


  // ==========================================================
  // 基準選手
  // ==========================================================

  if ($("target")) {

    $("target").innerHTML =

      members
        .map(
          (m, i) =>

            `<option value="${i}">
              ${i + 1}.
              ${esc(m.name)}
              (${m.id})
            </option>`

        )
        .join("");


    $("target").onchange =
      renderOpponents;

  }


  renderOpponents();

}


// ============================================================
// グラフ年選択欄を作る
// ============================================================

function setupGraphYears() {

  const startSelect =
    $("graphStartYear");


  const endSelect =
    $("graphEndYear");


  if (
    !startSelect ||
    !endSelect
  ) {
    return;
  }


  const currentYear =
    new Date()
      .getFullYear();


  // データにある最初の年
  let dataFirstYear =
    currentYear - 10;


  if (ratingHistory.length) {

    dataFirstYear =
      Math.min(
        ...ratingHistory.map(
          r =>
            r._date.getFullYear()
        )
      );

  }


  // 選択可能年
  const firstYear =
    Math.min(
      2000,
      dataFirstYear
    );


  const lastYear =
    Math.max(
      2040,
      currentYear
    );


  startSelect.innerHTML = "";

  endSelect.innerHTML = "";


  for (
    let year = firstYear;
    year <= lastYear;
    year++
  ) {

    startSelect.innerHTML +=
      `<option value="${year}">
        ${year}
      </option>`;


    endSelect.innerHTML +=
      `<option value="${year}">
        ${year}
      </option>`;

  }


  // ==========================================================
  // デフォルト
  // 開始年：今年 - 5
  // 終了年：今年
  // ==========================================================

  const defaultStart =
    Math.max(
      firstYear,
      currentYear - 5
    );


  startSelect.value =
    String(
      defaultStart
    );


  endSelect.value =
    String(
      currentYear
    );


  // ==========================================================
  // 開始年 > 終了年にならないようにする
  // ==========================================================

  startSelect.onchange =
    () => {

      if (
        Number(
          startSelect.value
        ) >
        Number(
          endSelect.value
        )
      ) {

        endSelect.value =
          startSelect.value;

      }

    };


  endSelect.onchange =
    () => {

      if (
        Number(
          endSelect.value
        ) <
        Number(
          startSelect.value
        )
      ) {

        startSelect.value =
          endSelect.value;

      }

    };

}


// ============================================================
// ============================================================
// レイティング推移グラフ
// ============================================================
// ============================================================

function renderLeagueGraph() {

  const target =
    $("leagueGraph");


  if (!target) {
    return;
  }


  const list =
    members.slice(0, 7);


  if (!list.length) {

    target.innerHTML =
      "<p>表示する参加者がいません。</p>";

    return;

  }


  if (!ratingHistory.length) {

    target.innerHTML = `

      <div class="card">

        <p style="text-align:center">

          レイティング履歴を
          読み込めませんでした。

        </p>

      </div>

    `;

    return;

  }


  // ==========================================================
  // 年を取得
  // ==========================================================

  const startYear =
    Number(
      $("graphStartYear").value
    );


  const endYear =
    Number(
      $("graphEndYear").value
    );


  if (
    !Number.isFinite(startYear) ||
    !Number.isFinite(endYear)
  ) {

    return;

  }


  if (
    startYear > endYear
  ) {

    alert(
      "開始年は終了年以前にしてください。"
    );

    return;

  }


  // ==========================================================
  // グラフの期間
  // ==========================================================

  const graphStart =
    new Date(
      startYear,
      0,
      1
    );


  const graphEnd =
    new Date(
      endYear,
      11,
      31,
      23,
      59,
      59
    );


  // ==========================================================
  // 各選手の履歴
  // ==========================================================

  const series =
    list.map(
      member => {

        const data =

          ratingHistory

            .filter(
              row =>
                row._memberId ===
                Number(member.id) &&

                row._date >=
                graphStart &&

                row._date <=
                graphEnd
            )

            .map(
              row => ({

                date:
                  row._date,

                rating:
                  row._rating

              })
            )

            .sort(
              (a, b) =>
                a.date - b.date
            );


        return {

          id:
            member.id,

          name:
            member.name,

          currentRating:
            member.rating,

          data

        };

      }

    );


  const validSeries =
    series.filter(
      s =>
        s.data.length > 0
    );


  if (!validSeries.length) {

    target.innerHTML = `

      <div class="card">

        <p style="text-align:center">

          ${startYear}年～${endYear}年の
          レイティング履歴が
          見つかりませんでした。

        </p>

      </div>

    `;

    return;

  }


  // ==========================================================
  // 全レイティング
  // ==========================================================

  const allRatings = [];


  validSeries.forEach(
    s => {

      s.data.forEach(
        p =>
          allRatings.push(
            p.rating
          )
      );

    }
  );


  const dataMin =
    Math.min(
      ...allRatings
    );


  const dataMax =
    Math.max(
      ...allRatings
    );


  const range =
    Math.max(
      100,
      dataMax - dataMin
    );


  let yMin =
    Math.floor(
      (
        dataMin -
        range * 0.10
      ) / 50
    ) * 50;


  let yMax =
    Math.ceil(
      (
        dataMax +
        range * 0.10
      ) / 50
    ) * 50;


  if (
    yMax <= yMin
  ) {

    yMax =
      yMin + 100;

  }


  // ==========================================================
  // SVGサイズ
  // ==========================================================

  const width =
    Math.max(
      650,
      target.clientWidth || 650
    );


  const height =
    430;


  const padding = {

    top: 35,

    right: 25,

    bottom: 65,

    left: 55

  };


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  // ==========================================================
  // X座標
  // ==========================================================

  const timeToX =
    date => {

      const total =
        graphEnd -
        graphStart;


      const current =
        date -
        graphStart;


      return (

        padding.left +

        chartWidth *
        (
          current /
          total
        )

      );

    };


  // ==========================================================
  // Y座標
  // ==========================================================

  const ratingToY =
    rating => {

      return (

        padding.top +

        chartHeight -

        (
          (
            rating -
            yMin
          ) /
          (
            yMax -
            yMin
          )
        ) *
        chartHeight

      );

    };


  // ==========================================================
  // 毎年の縦線
  // ==========================================================

  let yearLines = "";


  for (
    let year = startYear;
    year <= endYear;
    year++
  ) {

    const date =
      new Date(
        year,
        0,
        1
      );


    const x =
      timeToX(date);


    yearLines += `

      <line

        x1="${x}"

        y1="${padding.top}"

        x2="${x}"

        y2="${
          height -
          padding.bottom
        }"

        stroke="#999"

        stroke-width="1"

        stroke-dasharray="4 4"

        opacity="0.65"

      />

    `;

  }


  // ==========================================================
  // 年の文字
  // ==========================================================

  let yearLabels = "";


  for (
    let year = startYear;
    year <= endYear;
    year++
  ) {

    const date =
      new Date(
        year,
        0,
        1
      );


    const x =
      timeToX(date);


    yearLabels += `

      <text

        class="graph-year graph-year-${year}"

        x="${x}"

        y="${
          height -
          padding.bottom +
          28
        }"

        text-anchor="middle"

        font-size="12"

        fill="#444"

      >

        ${year}

      </text>

    `;

  }


  // ==========================================================
  // Y軸横線
  // ==========================================================

  let yGrid = "";


  const yStep =
    50;


  for (
    let rating = yMin;
    rating <= yMax;
    rating += yStep
  ) {

    const y =
      ratingToY(
        rating
      );


    yGrid += `

      <line

        x1="${padding.left}"

        y1="${y}"

        x2="${
          width -
          padding.right
        }"

        y2="${y}"

        stroke="#999"

        stroke-width="1"

        opacity="0.45"

      />


      <text

        x="${
          padding.left -
          8
        }"

        y="${y + 4}"

        text-anchor="end"

        font-size="12"

        fill="#555"

      >

        ${rating}

      </text>

    `;

  }


  // ==========================================================
  // 色
  // ==========================================================

  const lineColors = [

    "#e53935",
    "#43a047",
    "#1e88e5",
    "#00acc1",
    "#8e24aa",
    "#fb8c00",
    "#6d4c41"

  ];


  // ==========================================================
  // 線
  // ==========================================================

  let lines = "";


  validSeries.forEach(
    (s, index) => {

      const color =
        lineColors[
          index %
          lineColors.length
        ];


      const points =
        s.data

          .map(
            p =>

              `${timeToX(
                p.date
              )},${ratingToY(
                p.rating
              )}`

          )

          .join(" ");


      lines += `

        <polyline

          points="${points}"

          fill="none"

          stroke="${color}"

          stroke-width="2.5"

          stroke-linejoin="round"

          stroke-linecap="round"

        />

      `;


      // データポイント
      s.data.forEach(
        p => {

          lines += `

            <circle

              cx="${timeToX(
                p.date
              )}"

              cy="${ratingToY(
                p.rating
              )}"

              r="3"

              fill="${color}"

            />

          `;

        }
      );

    }
  );


  // ==========================================================
  // 凡例
  // ==========================================================

  let legend = "";


  validSeries.forEach(
    (s, index) => {

      const color =
        lineColors[
          index %
          lineColors.length
        ];


      legend += `

        <span

          style="
            display:inline-flex;
            align-items:center;
            margin:
              4px 10px 4px 0;
            white-space:nowrap;
          "

        >

          <span

            style="
              display:inline-block;
              width:22px;
              height:3px;
              background:${color};
              margin-right:5px;
            "

          ></span>

          ${esc(s.name)}

        </span>

      `;

    }
  );


  // ==========================================================
  // スマホ用
  // ==========================================================

  const mobileYearCSS = `

    <style>

      #leagueGraph
      .graph-year {

        font-size:12px;

      }


      @media
      (max-width:600px) {

        #leagueGraph
        .graph-year {

          display:none;

        }


        /*
         * スマホでは
         * 2年おき程度に年を表示
         *
         * 縦線自体は消さない
         */

        #leagueGraph
        .graph-year:nth-of-type(2n) {

          display:block;

        }

      }

    </style>

  `;


  // ==========================================================
  // 表示
  // ==========================================================

  target.innerHTML = `

    ${mobileYearCSS}


    <div class="card">

      <h3
        style="
          text-align:center;
          margin-bottom:4px;
        "
      >

        レイティング推移

      </h3>


      <p
        style="
          text-align:center;
          font-size:13px;
          color:#666;
          margin:0 0 8px;
        "
      >

        ${startYear}年 ～ ${endYear}年

      </p>


      <div
        style="
          text-align:center;
          font-size:13px;
          margin-bottom:10px;
        "
      >

        ${legend}

      </div>


      <div
        style="
          width:100%;
          overflow-x:auto;
          -webkit-overflow-scrolling:touch;
        "
      >

        <svg

          viewBox="
            0
            0
            ${width}
            ${height}
          "

          width="100%"

          height="${height}"

          preserveAspectRatio="
            xMinYMin meet
          "

          role="img"

          aria-label="
            選択された参加者の
            レイティング推移グラフ
          "

        >

          ${yearLines}

          ${yGrid}

          ${lines}

          ${yearLabels}

        </svg>

      </div>


      <p
        style="
          text-align:center;
          font-size:12px;
          color:#666;
          margin-top:8px;
        "
      >

        最大7名まで表示しています。

      </p>

    </div>

  `;

}


// ============================================================
// 対戦相手表示
// ============================================================

function renderOpponents() {

  if (
    !$("target") ||
    !$("opponents")
  ) {

    return;

  }


  const targetIndex =
    Number(
      $("target").value || 0
    );


  $("opponents").innerHTML =

    members

      .filter(
        (_, i) =>
          i !== targetIndex
      )

      .map(
        m => {

          const index =
            members.indexOf(m);


          return `

            <div

              class="opponent-row"

              style="
                padding:10px 0;
                border-bottom:
                  1px solid #e5e7eb;
              "

            >

              <div>

                <strong>
                  ${esc(m.name)}
                </strong>

                (${m.id})

                /

                レイティング

                ${
                  m.rating === "初"

                    ? `初`

                    : m.rating
                }

              </div>


              <!--
                ラジオボタンを
                元の押しやすい形に戻す
              -->

              <div

                style="
                  display:flex;
                  gap:22px;
                  margin-top:8px;
                "

              >

                <label

                  style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    min-height:36px;
                    cursor:pointer;
                    font-size:16px;
                    touch-action:manipulation;
                  "

                >

                  <input

                    type="radio"

                    name="
                      result-${index}
                    "

                    class="opp-result"

                    value="${index}:win"

                    style="
                      width:20px;
                      height:20px;
                      margin:0;
                    "

                  >

                  <span>勝</span>

                </label>


                <label

                  style="
                    display:flex;
                    align-items:center;
                    gap:6px;
                    min-height:36px;
                    cursor:pointer;
                    font-size:16px;
                    touch-action:manipulation;
                  "

                >

                  <input

                    type="radio"

                    name="
                      result-${index}
                    "

                    class="opp-result"

                    value="${index}:loss"

                    style="
                      width:20px;
                      height:20px;
                      margin:0;
                    "

                  >

                  <span>負</span>

                </label>

              </div>

            </div>

          `;

        }
      )

      .join("");

}


// ============================================================
// 勝敗計算
// ============================================================

function calculate() {

  if (!members.length) {
    return;
  }


  const numericRatings =

    members

      .map(
        m =>
          Number(m.rating)
      )

      .filter(
        n =>
          Number.isFinite(n)
      );


  const minRating =
    numericRatings.length
      ? Math.min(
          ...numericRatings
        )
      : 0;


  // 「初」は最低点として計算
  const getRating =
    member => {

      if (
        member.rating === "初"
      ) {

        return minRating;

      }


      const value =
        Number(
          member.rating
        );


      return Number.isFinite(value)
        ? value
        : minRating;

    };


  const targetIndex =
    Number(
      $("target").value
    );


  const base =
    getRating(
      members[targetIndex]
    );


  const selections =

    [
      ...document.querySelectorAll(
        ".opp-result:checked"
      )
    ];


  let total = 0;

  const rows = [];


  for (
    const input of selections
  ) {

    const [
      indexText,
      result
    ] =
      input.value.split(":");


    const index =
      Number(indexText);


    const opponent =
      members[index];


    const opponentRating =
      getRating(
        opponent
      );


    const diff =
      Math.abs(
        base -
        opponentRating
      );


    const record =
      POINTS.find(
        x =>
          diff <= x[0]
      ) ||
      POINTS.at(-1);


    const isLower =
      base <
      opponentRating;


    let change;


    if (
      result === "win"
    ) {

      change =
        isLower
          ? record[2]
          : record[1];

    }

    else {

      change =
        -(
          isLower
            ? record[1]
            : record[2]
        );

    }


    total +=
      change;


    rows.push({

      相手:
        opponent.name,

      相手レイティング:

        opponent.rating === "初"

          ? `初(${minRating})`

          : opponent.rating,

      差:
        diff,

      勝敗:

        result === "win"
          ? "勝"
          : "負",

      増減:

        (
          change >= 0
            ? "+"
            : ""
        ) +
        change

    });

  }


  const estimated =
    base +
    total;


  const totalText =
    (
      total >= 0
        ? "+"
        : ""
    ) +
    total;


  if (!$("calcResult")) {
    return;
  }


  $("calcResult").innerHTML = `

    <p>

      基準選手：

      ${esc(
        members[targetIndex].name
      )}

      /

      現在：

      ${
        members[targetIndex].rating === "初"

          ? `初(${minRating})`

          : members[targetIndex].rating
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
            選択してください。

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


// ============================================================
// HTMLテーブル
// ============================================================

function table(
  rows,
  columns
) {

  return `

    <div
      class="table-wrap"
    >

      <table>

        <thead>

          <tr>

            ${columns

              .map(
                column =>
                  `<th>
                    ${esc(column)}
                  </th>`
              )

              .join("")}

          </tr>

        </thead>


        <tbody>

          ${rows

            .map(
              row => `

                <tr>

                  ${columns

                    .map(
                      column =>

                        `<td>
                          ${esc(
                            row[column] ??
                            ""
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


// ============================================================
// CSV解析
// ============================================================

function parseCSV(text) {

  const rows = [];

  let row = [];

  let cell = "";

  let quoted = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const char =
      text[i];


    const next =
      text[i + 1];


    if (
      char === '"' &&
      quoted &&
      next === '"'
    ) {

      cell += '"';

      i++;

      continue;

    }


    if (
      char === '"'
    ) {

      quoted =
        !quoted;

      continue;

    }


    if (
      char === "," &&
      !quoted
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
        char === "\n" ||
        char === "\r"
      ) &&
      !quoted
    ) {

      if (
        char === "\r" &&
        next === "\n"
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
      char;

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


  if (!rows.length) {
    return [];
  }


  const headers =
    rows
      .shift()
      .map(
        x =>
          x.trim()
      );


  return rows.map(
    row =>

      Object.fromEntries(

        headers.map(
          (header, index) =>

            [
              header,
              (
                row[index] ??
                ""
              ).trim()
            ]

        )

      )

  );

}


// ============================================================
// HTMLエスケープ
// ============================================================

function esc(value) {

  return String(
    value
  ).replace(
    /[&<>"']/g,

    char =>

      ({
        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#39;"

      }[char])

  );

}
