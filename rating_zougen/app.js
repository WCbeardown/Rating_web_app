// ========================================
// 羽曳野レーティング増減計算
// ========================================


// ----------------------------------------
// Supabase
// ----------------------------------------

const SUPABASE_URL =
  "https://hbzjahdvxvlakbuiupcq.supabase.co";

// 既存の公開キーを入れてください
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_xQDcPbUu3LwFrFrsgpBhGQ_9edjU5EQ";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// ----------------------------------------
// グローバル変数
// ----------------------------------------

let ratingMap = null;


// ----------------------------------------
// 起動
// ----------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  const button = document.getElementById("calculateButton");

  button.addEventListener("click", calculate);

  loadRatingData();

});


// ----------------------------------------
// 大会番号を取得
// 例：第294回羽曳野RS大会 → 294
// ----------------------------------------

function extractTournamentNumber(text) {

  const match = text.match(/第\s*(\d+)\s*回/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}


// ----------------------------------------
// 会員番号を正規化
//
// Googleレンズで
// 12345678
// のように8桁になる場合は
// 先頭1桁を削除
// ----------------------------------------

function normalizeMemberId(value) {

  if (value === null || value === undefined) {
    return null;
  }

  let text = String(value).trim();

  if (!text) {
    return null;
  }

  // 数字以外を削除
  text = text.replace(/\D/g, "");

  if (!text) {
    return null;
  }

  // 8桁なら先頭1桁を削除
  if (text.length === 8) {
    text = text.substring(1);
  }

  return text;
}


// ----------------------------------------
// 名前らしい文字列か
// ----------------------------------------

function isNameCandidate(value) {

  if (!value) {
    return false;
  }

  const text = value.trim();

  if (!text) {
    return false;
  }

  // 数字だけなら名前ではない
  if (/^\d+$/.test(text)) {
    return false;
  }

  // 大会情報など
  if (/第\d+回/.test(text)) {
    return false;
  }

  return true;
}


// ----------------------------------------
// OCRテキストから参加者を抽出
// ----------------------------------------

function parseRecordsFromText(text) {

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== "");

  const records = [];

  for (const line of lines) {

    // 数字を抽出
    const numbers = line.match(/\d+/g);

    if (!numbers || numbers.length === 0) {
      continue;
    }

    let memberNo = null;

    // 6～8桁程度の数字を会員番号候補にする
    for (const n of numbers) {

      const normalized = normalizeMemberId(n);

      if (
        normalized &&
        normalized.length >= 5 &&
        normalized.length <= 7
      ) {
        memberNo = normalized;
        break;
      }
    }

    if (!memberNo) {
      continue;
    }


    // 会員番号以外の文字列から名前候補を探す
    const parts = line.split(/\s+/);

    let name = "";

    for (const part of parts) {

      if (
        part === memberNo ||
        /^\d+$/.test(part)
      ) {
        continue;
      }

      if (isNameCandidate(part)) {
        name = part;
        break;
      }
    }


    // レーティング候補
    let beforeRating = null;

    for (const n of numbers) {

      const value = Number(n);

      if (
        value >= 500 &&
        value <= 3000
      ) {
        beforeRating = value;
      }

    }

    if (!beforeRating) {
      continue;
    }


    records.push({
      memberNo,
      name,
      beforeRating
    });

  }

  return records;
}


// ----------------------------------------
// rating_data_all.csv を読み込む
// ----------------------------------------

async function loadRatingData() {

  try {

    setStatus("レーティングデータを読み込んでいます…");

    const response = await fetch(
      "../data/rating_data_all.csv",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {

      throw new Error(
        `CSV読み込み失敗（HTTP ${response.status}）`
      );

    }


    // 今回確認したCSVはUTF-8
    const buffer = await response.arrayBuffer();

    let text = new TextDecoder("utf-8").decode(buffer);

    // BOM除去
    text = text.replace(/^\uFEFF/, "");


    const rows = parseCSV(text);


    // 高速検索用Map
    ratingMap = new Map();


    for (const row of rows) {

      const place =
        String(row["場所"] ?? "").trim();

      const tournament =
        Number(
          String(row["回"] ?? "").trim()
        );

      const member =
        normalizeMemberId(row["会員番号"]);

      const rating =
        Number(
          String(row["レイティング"] ?? "").trim()
        );


      if (
        place !== "羽曳野" ||
        !Number.isFinite(tournament) ||
        member === null ||
        !Number.isFinite(rating)
      ) {
        continue;
      }


      const key =
        `${tournament}_${member}`;

      ratingMap.set(key, rating);

    }


    setStatus(
      `レーティングデータ読み込み完了`
    );

  } catch (error) {

    console.error(error);

    setStatus(
      "レーティングデータを読み込めませんでした。",
      true
    );

  }

}


// ----------------------------------------
// CSVパーサー
// ----------------------------------------

function parseCSV(text) {

  const rows = [];

  let row = [];
  let cell = "";
  let quoted = false;


  for (let i = 0; i < text.length; i++) {

    const c = text[i];
    const next = text[i + 1];


    if (
      c === '"' &&
      quoted &&
      next === '"'
    ) {

      cell += '"';
      i++;

      continue;
    }


    if (c === '"') {

      quoted = !quoted;

      continue;
    }


    if (
      c === "," &&
      !quoted
    ) {

      row.push(cell);
      cell = "";

      continue;
    }


    if (
      (c === "\n" || c === "\r") &&
      !quoted
    ) {

      if (
        c === "\r" &&
        next === "\n"
      ) {
        i++;
      }

      row.push(cell);
      cell = "";

      if (
        row.some(
          value => value.trim() !== ""
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
    cell !== "" ||
    row.length
  ) {

    row.push(cell);
    rows.push(row);

  }


  if (rows.length === 0) {
    return [];
  }


  const headers =
    rows.shift().map(
      value => value.trim()
    );


  return rows.map(row => {

    const object = {};

    headers.forEach((header, index) => {

      object[header] =
        (row[index] ?? "").trim();

    });

    return object;

  });

}


// ----------------------------------------
// 大会後レーティングを検索
// ----------------------------------------

function findAfterRating(
  tournamentNumber,
  memberNo
) {

  if (!ratingMap) {
    return null;
  }


  const normalized =
    normalizeMemberId(memberNo);

  if (!normalized) {
    return null;
  }


  const key =
    `${tournamentNumber}_${normalized}`;


  return ratingMap.get(key) ?? null;

}


// ----------------------------------------
// 増減計算
// ----------------------------------------

async function calculate() {

  const text =
    document.getElementById("textInput").value.trim();


  if (!text) {

    setStatus(
      "OCRテキストを貼り付けてください。",
      true
    );

    return;
  }


  if (!ratingMap) {

    setStatus(
      "レーティングデータを読み込んでいます。少し待ってから再度押してください。",
      true
    );

    return;
  }


  // 大会番号
  const tournamentNumber =
    extractTournamentNumber(text);


  if (!tournamentNumber) {

    setStatus(
      "大会番号（第○回）が見つかりませんでした。",
      true
    );

    return;
  }


  // OCRから参加者を抽出
  const records =
    parseRecordsFromText(text);


  if (records.length === 0) {

    setStatus(
      "参加者データを読み取れませんでした。",
      true
    );

    return;
  }


  // 大会後レーティングを取得
  const results = records.map(record => {

    const afterRating =
      findAfterRating(
        tournamentNumber,
        record.memberNo
      );


    let change = null;

    if (afterRating !== null) {

      change =
        afterRating - record.beforeRating;

    }


    return {
      ...record,
      afterRating,
      change
    };

  });


  renderResults(
    tournamentNumber,
    results
  );


  // ------------------------------------
  // Supabaseへ利用ログ
  // 「増減表示」ボタンを押したときだけ
  // ------------------------------------

  saveUsageData({
    tournamentNumber
  });

}


// ----------------------------------------
// 結果表示
// ----------------------------------------

function renderResults(
  tournamentNumber,
  results
) {

  const section =
    document.getElementById("resultSection");

  const title =
    document.getElementById("resultTitle");

  const body =
    document.getElementById("resultBody");


  title.textContent =
    `第${tournamentNumber}回　結果`;


  body.innerHTML =
    results.map(record => {

      let changeText = "";

      if (record.change !== null) {

        if (record.change > 0) {
          changeText = `+${record.change}`;
        } else {
          changeText =
            String(record.change);
        }

      } else {

        changeText = "―";

      }


      let changeClass = "";

      if (record.change > 0) {
        changeClass = "positive";
      }

      if (record.change < 0) {
        changeClass = "negative";
      }


      return `
        <tr>

          <td>
            ${escapeHtml(record.memberNo)}
          </td>

          <td>
            ${escapeHtml(record.name)}
          </td>

          <td>
            ${record.beforeRating}
          </td>

          <td>
            ${
              record.afterRating !== null
                ? record.afterRating
                : "―"
            }
          </td>

          <td class="${changeClass}">
            ${changeText}
          </td>

        </tr>
      `;

    }).join("");


  section.classList.remove("hidden");


  // 結果までスクロール
  section.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


// ----------------------------------------
// Supabase 利用ログ
// ----------------------------------------

async function saveUsageData(data) {

  try {

    const { error } =
      await supabaseClient
        .from("app_usage")
        .insert({
          app_name: "rating_change",
          action: "calculate",
          input_data: data
        });


    if (error) {

      console.error(
        "利用ログ保存エラー:",
        error
      );

    }

  } catch (error) {

    console.error(
      "利用ログ保存エラー:",
      error
    );

  }

}


// ----------------------------------------
// ステータス表示
// ----------------------------------------

function setStatus(
  message,
  isError = false
) {

  const status =
    document.getElementById("status");

  status.textContent = message;

  status.classList.toggle(
    "error",
    isError
  );

}


// ----------------------------------------
// HTMLエスケープ
// ----------------------------------------

function escapeHtml(value) {

  return String(value).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );

}
