// ========================================
// Supabase
// ========================================

const SUPABASE_URL =
  "https://hbzjahdvxvlakbuiupcq.supabase.co";

// 既存アプリで使用しているPublishable Key
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_xQDcPbUu3LwFrFrsgpBhGQ_9edjU5EQ";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


// ========================================
// DOM
// ========================================

const $ = id =>
  document.getElementById(id);


document.addEventListener(
  "DOMContentLoaded",
  () => {

    $("calculateButton")
      .addEventListener(
        "click",
        calculate
      );

  }
);


// ========================================
// 大会番号を取得
// ========================================

function extractTournamentNumber(text) {

  if (!text) {
    return null;
  }

  const patterns = [

    /第\s*(\d+)\s*回\s*羽曳野RS大会/,
    /第\s*(\d+)\s*回\s*羽曳野/,
    /第\s*(\d+)\s*回/

  ];

  for (const pattern of patterns) {

    const match =
      text.match(pattern);

    if (match) {
      return Number(match[1]);
    }

  }

  return null;
}


// ========================================
// 会員番号を正規化
// ========================================

function normalizeMemberId(value) {

  let text =
    String(value).trim();

  if (!text) {
    return null;
  }

  // OCRで8桁になっている場合
  // 先頭1桁を削除
  if (/^\d{8}$/.test(text)) {

    text =
      text.substring(1);

  }

  // 数字以外を削除
  text =
    text.replace(/\D/g, "");

  if (!text) {
    return null;
  }

  return Number(text);
}


// ========================================
// 見出し判定
// ========================================

function isHeading(text) {

  const headers = [
    "参加者",
    "第",
    "大会",
    "グループ",
    "ブロック",
    "コート",
    "会員番号",
    "氏名",
    "上位希望者",
    "回",
    "合番号"
  ];

  if (
    headers.some(
      header =>
        text.includes(header)
    )
  ) {
    return true;
  }

  if (
    /^[\|\(\)\-\*]+$/.test(text)
  ) {
    return true;
  }

  if (
    /\d{4}\/\d{1,2}\/\d{1,2}/.test(text)
  ) {
    return true;
  }

  if (
    text.includes("年") &&
    text.includes("月")
  ) {
    return true;
  }

  return false;
}


// ========================================
// 氏名候補判定
// ========================================

function isNameCandidate(text) {

  if (!text) {
    return false;
  }

  if (isHeading(text)) {
    return false;
  }

  if (/\d{2,4}年/.test(text)) {
    return false;
  }

  if (text.includes("月")) {
    return false;
  }

  const digits =
    [...text]
      .filter(c => /\d/.test(c))
      .length;

  if (
    text.length > 0 &&
    digits / text.length > 0.5
  ) {
    return false;
  }

  return /[ぁ-んァ-ヶ一-龯A-Za-z]/.test(text);
}


// ========================================
// OCRテキスト解析
// ========================================

function parseRecordsFromText(text) {

  text =
    text
      .replace(/\u3000/g, " ")
      .replace(/\ufeff/g, "")
      .replace(/\u00a0/g, " ");

  const lines =
    text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== "");

  const memberIdRegex =
    /\d{6,8}/g;

  const ratingRegex =
    /(?<!\d)(\d{4})(?!\d)/;

  const records = [];

  const seenIds =
    new Set();


  for (
    let i = 0;
    i < lines.length;
    i++
  ) {

    const line =
      lines[i];

    const ids =
      line.match(memberIdRegex);

    if (!ids) {
      continue;
    }


    for (const memberIdRaw of ids) {

      const memberId =
        normalizeMemberId(
          memberIdRaw
        );

      if (!memberId) {
        continue;
      }

      if (seenIds.has(memberId)) {
        continue;
      }


      let name = null;
      let ratingBefore = null;


      const pos =
        line.indexOf(
          memberIdRaw
        );

      const remainder =
        line
          .substring(
            pos +
            memberIdRaw.length
          )
          .trim();


      // --------------------------------
      // 同じ行から取得
      // --------------------------------

      if (remainder) {

        const ratingMatch =
          remainder.match(
            ratingRegex
          );

        if (ratingMatch) {

          ratingBefore =
            Number(
              ratingMatch[1]
            );

          const candidate =
            remainder
              .substring(
                0,
                ratingMatch.index
              )
              .trim();

          if (
            candidate &&
            isNameCandidate(candidate)
          ) {
            name = candidate;
          }

        }
        else if (
          isNameCandidate(remainder)
        ) {

          name = remainder;

        }

      }


      // --------------------------------
      // 次の数行から取得
      // --------------------------------

      if (
        !name ||
        ratingBefore === null
      ) {

        for (
          let j = i + 1;
          j < Math.min(
            i + 6,
            lines.length
          );
          j++
        ) {

          const s =
            lines[j];

          if (isHeading(s)) {
            continue;
          }

          const match =
            s.match(
              ratingRegex
            );

          if (match) {

            if (
              /^\d{4}$/.test(s)
            ) {

              ratingBefore =
                Number(s);

              continue;

            }
            else {

              const candidate =
                s
                  .substring(
                    0,
                    match.index
                  )
                  .trim();

              if (
                candidate &&
                isNameCandidate(
                  candidate
                )
              ) {

                name = candidate;

                ratingBefore =
                  Number(
                    match[1]
                  );

                break;
              }

            }

          }


          if (
            isNameCandidate(s)
          ) {

            name = s;

            const match2 =
              s.match(
                ratingRegex
              );

            if (match2) {

              ratingBefore =
                Number(
                  match2[1]
                );

              name =
                s
                  .substring(
                    0,
                    match2.index
                  )
                  .trim();

            }

            break;
          }

        }

      }


      // --------------------------------
      // レーティングだけ探す
      // --------------------------------

      if (
        ratingBefore === null
      ) {

        for (
          let j = i;
          j < Math.min(
            i + 8,
            lines.length
          );
          j++
        ) {

          const s =
            lines[j];

          const match =
            s.match(
              ratingRegex
            );

          if (match) {

            ratingBefore =
              Number(
                match[1]
              );

            break;

          }

          // 「初」の場合は
          // 大会前レーティングなし
          if (
            s.includes("初")
          ) {

            ratingBefore =
              null;

            break;
          }

        }

      }


      // --------------------------------
      // 氏名を整理
      // --------------------------------

      if (name) {

        name =
          name.replace(
            /\d{6,8}/,
            ""
          );

        name =
          name.replace(
            /\b\d+\b$/,
            ""
          );

        name =
          name.replace(
            /\s+/g,
            " "
          );

        name =
          name.trim();

        if (!name) {
          name = null;
        }

      }


      seenIds.add(memberId);


      records.push({

        memberNo:
          memberId,

        name:
          name || "",

        ratingBefore:
          ratingBefore

      });

    }

  }

  return records;
}


// ========================================
// rating_data_all.csvを読み込む
// ========================================

let ratingData = null;


async function loadRatingData() {

  if (ratingData) {
    return ratingData;
  }


  const response =
    await fetch(
      "../data/rating_data_all.csv",
      {
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      `rating_data_all.csvを読み込めませんでした（HTTP ${response.status}）`
    );

  }


  // 既存CSVは日本語データなので
  // Shift-JISを想定
  const buffer =
    await response.arrayBuffer();


  const decoder =
    new TextDecoder("utf-8");



  const text =
    decoder.decode(buffer);


  ratingData =
    parseCSV(text);


  return ratingData;
}


// ========================================
// CSV解析
// ========================================

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

    const c =
      text[i];

    const next =
      text[i + 1];


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

      quoted =
        !quoted;

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
      (c === "\n" ||
       c === "\r") &&
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
          x =>
            x.trim() !== ""
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


  if (!rows.length) {
    return [];
  }


  const headers =
    rows.shift()
      .map(
        x => x.trim()
      );


  return rows.map(row => {

    const obj = {};

    headers.forEach(
      (header, index) => {

        obj[header] =
          (row[index] ?? "")
            .trim();

      }
    );

    return obj;

  });
}


// ========================================
// CSVから大会後レーティングを探す
// ========================================

function findAfterRating(
  tournamentNumber,
  memberNo
) {

  if (!ratingData) {
    return null;
  }


  const targetMember =
    String(
      normalizeMemberId(memberNo)
    );


  for (
    const row of ratingData
  ) {

    const rowTournament =
      Number(
        String(
          row["回"] ?? ""
        ).trim()
      );

    const rowMember =
      normalizeMemberId(
        row["会員番号"]
      );


    const rowPlace =String(row["場所"] ?? "").trim();

    if (
      rowPlace === "羽曳野" &&
      rowTournament === tournamentNumber &&
      rowMember !== null &&
      String(rowMember) === targetMember
    ) {

      const rating =
        Number(
          String(
            row["レイティング"] ?? ""
          ).trim()
        );

      if (
        Number.isFinite(rating)
      ) {

        return rating;

      }

    }

  }

  return null;
}


// ========================================
// メイン処理
// ========================================

async function calculate() {

  const text =
    $("textInput")
      .value
      .trim();


  $("status").textContent =
    "";

  $("resultSection")
    .classList.add("hidden");


  if (!text) {

    $("status").textContent =
      "OCRテキストを貼り付けてください。";

    $("status").className =
      "error";

    return;
  }


  // --------------------------------
  // 大会番号取得
  // --------------------------------

  const tournamentNumber =
    extractTournamentNumber(
      text
    );


  if (!tournamentNumber) {

    $("status").textContent =
      "大会番号（例：第294回）を検出できませんでした。";

    $("status").className =
      "error";

    return;
  }


  $("status").textContent =
    `第${tournamentNumber}回のデータを解析しています……`;

  $("status").className =
    "loading";


  try {

    // --------------------------------
    // CSV読み込み
    // --------------------------------

    await loadRatingData();


    // --------------------------------
    // OCR解析
    // --------------------------------

    const records =
      parseRecordsFromText(
        text
      );


    if (!records.length) {

      throw new Error(
        "参加者データを抽出できませんでした。"
      );

    }


    // --------------------------------
    // 大会後レーティング検索
    // --------------------------------

    const results =
      records.map(
        record => {

          const ratingAfter =
            findAfterRating(
              tournamentNumber,
              record.memberNo
            );


          let change = null;


          if (
            record.ratingBefore !== null &&
            ratingAfter !== null
          ) {

            change =
              ratingAfter -
              record.ratingBefore;

          }


          return {

            ...record,

            ratingAfter,

            change

          };

        }
      );


    // --------------------------------
    // 結果表示
    // --------------------------------

    renderResults(
      tournamentNumber,
      results
    );


    const found =
      results.filter(
        row =>
          row.ratingAfter !== null
      ).length;


    $("status").textContent =
      `${records.length}名を解析しました。` +
      ` 大会後レーティング取得：${found}名`;

    $("status").className =
      "success";


    // --------------------------------
    // Supabase利用ログ
    //
    // 「増減表示」を押した時だけ
    // ここが実行される
    // --------------------------------

    saveUsageData({
      tournamentNumber:
        tournamentNumber
    });

  }
  catch (error) {

    console.error(error);


    $("status").textContent =
      error.message ||
      "処理中にエラーが発生しました。";

    $("status").className =
      "error";

  }

}


// ========================================
// 結果表示
// ========================================

function renderResults(
  tournamentNumber,
  results
) {

  $("resultTitle").textContent =
    `第${tournamentNumber}回羽曳野レイティング大会の増減結果`;


  $("resultBody").innerHTML =
    results
      .map(row => {

        let changeText =
          "－";


        if (
          row.change !== null
        ) {

          if (
            row.change > 0
          ) {

            changeText =
              `+${row.change}`;

          }
          else {

            changeText =
              String(
                row.change
              );

          }

        }


        let changeClass =
          "";


        if (
          row.change > 0
        ) {

          changeClass =
            "positive";

        }
        else if (
          row.change < 0
        ) {

          changeClass =
            "negative";

        }


        return `
          <tr>

            <td>
              ${escapeHtml(
                row.memberNo
              )}
            </td>

            <td>
              ${escapeHtml(
                row.name
              )}
            </td>

            <td>
              ${
                row.ratingBefore ??
                "－"
              }
            </td>

            <td>
              ${
                row.ratingAfter ??
                "－"
              }
            </td>

            <td class="${changeClass}">
              ${changeText}
            </td>

          </tr>
        `;

      })
      .join("");


  $("resultSection")
    .classList.remove(
      "hidden"
    );
}


// ========================================
// Supabase利用ログ
// ========================================

async function saveUsageData(data) {

  try {

    const { error } =
      await supabaseClient
        .from("app_usage")
        .insert({

          app_name:
            "rating_change",

          action:
            "calculate",

          input_data:
            data

        });


    if (error) {

      console.error(
        "利用ログ保存エラー:",
        error
      );

    }

  }
  catch (error) {

    console.error(
      "利用ログ保存エラー:",
      error
    );

  }

}


// ========================================
// HTMLエスケープ
// ========================================

function escapeHtml(value) {

  return String(value)
    .replace(
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
