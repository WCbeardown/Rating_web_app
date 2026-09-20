// ============================================================
// 羽曳野レーティング増減計算
// ============================================================


// ============================================================
// Supabase
// ============================================================

const SUPABASE_URL =
  "https://hbzjahdvxvlakbuiupcq.supabase.co";

// 既存のPublishable Keyをそのまま使用
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_xQDcPbUu3LwFrFrsgpBhGQ_9edjU5EQ";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


// ============================================================
// グローバル変数
// ============================================================

let ratingMap = new Map();


// ============================================================
// 初期処理
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const button =
      document.getElementById(
        "calculateButton"
      );

    if (!button) {

      console.error(
        "calculateButton が見つかりません"
      );

      return;
    }


    button.addEventListener(
      "click",
      calculate
    );


    loadRatingData();

  }
);


// ============================================================
// 大会番号
// 例：第315回羽曳野RS大会 → 315
// ============================================================

function extractTournamentNumber(text) {

  if (!text) {
    return null;
  }


  const match =
    text.match(
      /第\s*(\d+)\s*回/
    );


  if (!match) {
    return null;
  }


  return Number(match[1]);

}


// ============================================================
// 会員番号の正規化
//
// Googleレンズで8桁になる場合
// 先頭1桁を削除する
//
// 例
// 12500043 → 2500043
// ============================================================

function normalizeMemberId(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  let text =
    String(value).trim();


  if (
    text === "" ||
    text.toLowerCase() === "nan"
  ) {
    return null;
  }


  // 数字以外を除去
  text =
    text.replace(
      /\D/g,
      ""
    );


  if (!text) {
    return null;
  }


  // 8桁なら先頭1桁を削除
  if (text.length === 8) {

    text =
      text.substring(1);

  }


  if (!/^\d+$/.test(text)) {
    return null;
  }


  return text;

}


// ============================================================
// 見出しかどうか
// ============================================================

function isHeading(text) {

  if (!text) {
    return true;
  }


  const headers = [
    "参加者",
    "第",
    "大会",
    "グループ",
    "ブロック",
    "コート",
    "会員番号",
    "氏名",
    "R",
    "Z=",
    "上位希望者",
    "回"
  ];


  if (
    headers.some(
      h => text.includes(h)
    )
  ) {
    return true;
  }


  if (
    /^[|()\-*]+$/.test(text)
  ) {
    return true;
  }


  if (
    /\d{4}\/\d{1,2}\/\d{1,2}/.test(text)
  ) {
    return true;
  }


  return false;

}


// ============================================================
// 氏名候補かどうか
// ============================================================

function isNameCandidate(text) {

  if (!text) {
    return false;
  }


  text =
    String(text).trim();


  if (!text) {
    return false;
  }


  if (isHeading(text)) {
    return false;
  }


  // 数字だけ
  if (/^\d+$/.test(text)) {
    return false;
  }


  // 日付
  if (
    /\d{4}\/\d{1,2}\/\d{1,2}/.test(text)
  ) {
    return false;
  }


  // 数字の割合が高すぎるものは除外
  const digits =
    (text.match(/\d/g) || []).length;


  if (
    digits / text.length > 0.5
  ) {
    return false;
  }


  // 日本語または英字を含む
  return /[ぁ-んァ-ヶ一-龯A-Za-z]/.test(
    text
  );

}


// ============================================================
// 氏名を整理
// ============================================================

function cleanName(value) {

  if (!value) {
    return "";
  }


  let name =
    String(value).trim();


  // 順位番号を先頭から削除
  name =
    name.replace(
      /^\d+\s*/,
      ""
    );


  // 末尾のZ
  name =
    name.replace(
      /\s*[Zz]\s*$/,
      ""
    );


  // 末尾の「初」
  name =
    name.replace(
      /\s*初\s*$/,
      ""
    );


  // レーティングを末尾から削除
  name =
    name.replace(
      /\s+\d{4}\s*$/,
      ""
    );


  // 会員番号が混ざっていたら削除
  name =
    name.replace(
      /\b\d{6,8}\b/g,
      ""
    );


  // 空白を整理
  name =
    name.replace(
      /\s+/g,
      " "
    ).trim();


  return name;

}


// ============================================================
// OCRテキストから参加者を解析
// ============================================================

function parseRecordsFromText(text) {

  text =
    text
      .replace(/\u3000/g, " ")
      .replace(/\ufeff/g, "")
      .replace(/\xa0/g, " ");


  const lines =
    text
      .split(/\r?\n/)
      .map(
        line => line.trim()
      )
      .filter(
        line => line !== ""
      );


  const memberIdRegex =
    /(?<!\d)\d{6,8}(?!\d)/g;


  const ratingRegex =
    /(?<!\d)(\d{4})(?!\d)/;


  const records = [];

  const seenIds =
    new Set();


  // ----------------------------------------------------------
  // 全会員番号の出現位置を取得
  // ----------------------------------------------------------

  const occurrences = [];


  for (
    let i = 0;
    i < lines.length;
    i++
  ) {

    const line =
      lines[i];


    memberIdRegex.lastIndex = 0;


    let match;


    while (
      (match =
        memberIdRegex.exec(line))
      !== null
    ) {

      occurrences.push({
        lineIndex: i,
        start: match.index,
        end:
          match.index +
          match[0].length,
        rawId: match[0]
      });

    }

  }


  // ----------------------------------------------------------
  // 会員番号ごとに解析
  // ----------------------------------------------------------

  for (
    let occurrenceIndex = 0;
    occurrenceIndex <
    occurrences.length;
    occurrenceIndex++
  ) {

    const occurrence =
      occurrences[
        occurrenceIndex
      ];


    const memberId =
      normalizeMemberId(
        occurrence.rawId
      );


    if (!memberId) {
      continue;
    }


    if (
      seenIds.has(memberId)
    ) {
      continue;
    }


    let name = "";

    let beforeRating = null;


    // --------------------------------------------------------
    // 同じ行にある次の会員番号
    // --------------------------------------------------------

    const nextOccurrence =
      occurrences[
        occurrenceIndex + 1
      ];


    let sameLineEnd =
      lines[
        occurrence.lineIndex
      ].length;


    if (
      nextOccurrence &&
      nextOccurrence.lineIndex ===
        occurrence.lineIndex
    ) {

      sameLineEnd =
        nextOccurrence.start;

    }


    const sameLineRemainder =
      lines[
        occurrence.lineIndex
      ]
        .substring(
          occurrence.end,
          sameLineEnd
        )
        .trim();


    // --------------------------------------------------------
    // 同じ行から氏名・レーティングを取得
    // --------------------------------------------------------

    if (sameLineRemainder) {

      const ratingMatch =
        sameLineRemainder.match(
          ratingRegex
        );


      if (ratingMatch) {

        const rating =
          Number(
            ratingMatch[1]
          );


        if (
          rating >= 500 &&
          rating <= 3000
        ) {

          beforeRating =
            rating;

        }


        const nameCandidate =
          sameLineRemainder
            .substring(
              0,
              ratingMatch.index
            )
            .trim();


        if (
          isNameCandidate(
            nameCandidate
          )
        ) {

          name =
            cleanName(
              nameCandidate
            );

        }

      }

      else if (
        isNameCandidate(
          sameLineRemainder
        )
      ) {

        name =
          cleanName(
            sameLineRemainder
          );

      }

    }


    // --------------------------------------------------------
    // 次の行以降を探索
    // --------------------------------------------------------

    if (
      !name ||
      beforeRating === null
    ) {

      const nextDifferentLine =
        nextOccurrence
          ? nextOccurrence.lineIndex
          : lines.length;


      const maxLine =
        Math.min(
          nextDifferentLine,
          occurrence.lineIndex + 7
        );


      for (
        let j =
          occurrence.lineIndex + 1;
        j < maxLine;
        j++
      ) {

        const line =
          lines[j];


        if (
          isHeading(line)
        ) {
          continue;
        }


        // ----------------------------------------------
        // 「初」
        // ----------------------------------------------

        if (
          line === "初"
        ) {

          continue;

        }


        // ----------------------------------------------
        // レーティングを探す
        // ----------------------------------------------

        const ratingMatch =
          line.match(
            ratingRegex
          );


        if (ratingMatch) {

          const rating =
            Number(
              ratingMatch[1]
            );


          if (
            rating >= 500 &&
            rating <= 3000
          ) {

            if (
              beforeRating === null
            ) {

              beforeRating =
                rating;

            }


            // レーティングより前が氏名
            const nameCandidate =
              line
                .substring(
                  0,
                  ratingMatch.index
                )
                .trim();


            if (
              !name &&
              isNameCandidate(
                nameCandidate
              )
            ) {

              name =
                cleanName(
                  nameCandidate
                );

              break;

            }

            continue;

          }

        }


        // ----------------------------------------------
        // 氏名だけの行
        // ----------------------------------------------

        if (
          !name &&
          isNameCandidate(line)
        ) {

          name =
            cleanName(line);

        }

      }

    }


    // --------------------------------------------------------
    // レーティングだけ後ろにある場合
    // --------------------------------------------------------

    if (
      beforeRating === null
    ) {

      const nextDifferentLine =
        nextOccurrence
          ? nextOccurrence.lineIndex
          : lines.length;


      const maxLine =
        Math.min(
          nextDifferentLine,
          occurrence.lineIndex + 8
        );


      for (
        let j =
          occurrence.lineIndex;
        j < maxLine;
        j++
      ) {

        const line =
          lines[j];


        const ratingMatch =
          line.match(
            ratingRegex
          );


        if (ratingMatch) {

          const rating =
            Number(
              ratingMatch[1]
            );


          if (
            rating >= 500 &&
            rating <= 3000
          ) {

            beforeRating =
              rating;

            break;

          }

        }


        // 初の場合は大会前レーティングなし
        if (
          line.includes("初")
        ) {

          break;

        }

      }

    }


    // --------------------------------------------------------
    // 氏名整理
    // --------------------------------------------------------

    if (name) {

      name =
        cleanName(name);

    }


    // --------------------------------------------------------
    // 登録
    // --------------------------------------------------------

    seenIds.add(memberId);


    records.push({

      memberNo:
        memberId,

      name:
        name || "",

      beforeRating:
        beforeRating

    });

  }


  return records;

}


// ============================================================
// CSV読み込み
// ============================================================

async function loadRatingData() {

  try {

    setStatus(
      "レーティングデータを読み込んでいます…"
    );


    const csvUrl =
      new URL(
        "../data/rating_data_all.csv",
        window.location.href
      ).href;


    const response =
      await fetch(
        csvUrl,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        `CSV読み込み失敗（HTTP ${response.status}）`
      );

    }


    const buffer =
      await response.arrayBuffer();


    // rating_data_all.csv はUTF-8
    let text =
      new TextDecoder(
        "utf-8"
      ).decode(buffer);


    text =
      text.replace(
        /^\uFEFF/,
        ""
      );


    const rows =
      parseCSV(text);


    ratingMap =
      new Map();


    for (
      const row of rows
    ) {

      const place =
        String(
          row["場所"] ?? ""
        ).trim();


      if (
        place !== "羽曳野"
      ) {
        continue;
      }


      const tournament =
        Number(
          String(
            row["回"] ?? ""
          ).trim()
        );


      const member =
        normalizeMemberId(
          row["会員番号"]
        );


      const rating =
        Number(
          String(
            row["レイティング"] ?? ""
          )
            .replace(
              /,/g,
              ""
            )
            .trim()
        );


      if (
        !Number.isFinite(
          tournament
        )
      ) {
        continue;
      }


      if (!member) {
        continue;
      }


      if (
        !Number.isFinite(
          rating
        )
      ) {
        continue;
      }


      const key =
        `${tournament}_${member}`;


      ratingMap.set(
        key,
        rating
      );

    }


    console.log(
      "羽曳野レーティング件数:",
      ratingMap.size
    );


    setStatus(
      "レーティングデータ読み込み完了"
    );


  }
  catch (error) {

    console.error(
      "CSV読み込みエラー:",
      error
    );


    setStatus(
      "レーティングデータを読み込めませんでした。",
      true
    );

  }

}


// ============================================================
// CSVパーサー
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

      row.push(cell);

      cell = "";

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


    cell += char;

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
    rows
      .shift()
      .map(
        header =>
          header
            .trim()
            .replace(
              /^\uFEFF/,
              ""
            )
      );


  return rows.map(
    values => {

      const object = {};


      headers.forEach(
        (
          header,
          index
        ) => {

          object[header] =
            (
              values[index] ??
              ""
            ).trim();

        }
      );


      return object;

    }
  );

}


// ============================================================
// 大会後レーティング検索
// ============================================================

function findAfterRating(
  tournamentNumber,
  memberNo
) {

  const member =
    normalizeMemberId(
      memberNo
    );


  if (!member) {
    return null;
  }


  const key =
    `${tournamentNumber}_${member}`;


  return (
    ratingMap.get(key) ??
    null
  );

}


// ============================================================
// 増減計算
// ============================================================

async function calculate() {

  console.log(
    "増減表示ボタンが押されました"
  );


  const input =
    document.getElementById(
      "textInput"
    );


  const text =
    input
      ? input.value.trim()
      : "";


  if (!text) {

    setStatus(
      "OCRテキストを貼り付けてください。",
      true
    );

    return;

  }


  if (
    !ratingMap ||
    ratingMap.size === 0
  ) {

    setStatus(
      "レーティングデータを読み込んでいます。少し待ってから再度押してください。",
      true
    );

    return;

  }


  // ----------------------------------------------------------
  // 大会番号
  // ----------------------------------------------------------

  const tournamentNumber =
    extractTournamentNumber(
      text
    );


  if (!tournamentNumber) {

    setStatus(
      "大会番号（第○回）が見つかりませんでした。",
      true
    );

    return;

  }


  // ----------------------------------------------------------
  // OCR解析
  // ----------------------------------------------------------

  const records =
    parseRecordsFromText(
      text
    );


  console.log(
    "大会番号:",
    tournamentNumber
  );

  console.log(
    "OCRから抽出した人数:",
    records.length
  );

  console.log(
    "抽出結果:",
    records
  );


  if (
    records.length === 0
  ) {

    setStatus(
      "会員番号を読み取れませんでした。",
      true
    );

    return;

  }


  // ----------------------------------------------------------
  // 大会後レーティングと照合
  // ----------------------------------------------------------

  const results =
    records.map(
      record => {

        const afterRating =
          findAfterRating(
            tournamentNumber,
            record.memberNo
          );


        let change =
          null;


        if (
          afterRating !== null &&
          record.beforeRating !== null
        ) {

          change =
            afterRating -
            record.beforeRating;

        }


        return {

          ...record,

          afterRating,

          change

        };

      }
    );


  // ----------------------------------------------------------
  // 結果表示
  // ----------------------------------------------------------

  renderResults(
    tournamentNumber,
    results
  );


  // ----------------------------------------------------------
  // Supabase利用ログ
  // ボタンを押したときだけ記録
  // ----------------------------------------------------------

  saveUsageData({

    tournamentNumber

  });

}


// ============================================================
// 結果表示
// ============================================================

function renderResults(
  tournamentNumber,
  results
) {

  const section =
    document.getElementById(
      "resultSection"
    );


  const title =
    document.getElementById(
      "resultTitle"
    );


  const body =
    document.getElementById(
      "resultBody"
    );


  if (
    !section ||
    !title ||
    !body
  ) {

    console.error(
      "結果表示用HTMLが見つかりません"
    );

    return;

  }


  title.textContent =
    `第${tournamentNumber}回　結果`;


  body.innerHTML =
    results
      .map(
        record => {

          let changeText =
            "―";


          if (
            record.change !== null
          ) {

            if (
              record.change > 0
            ) {

              changeText =
                `+${record.change}`;

            }
            else {

              changeText =
                String(
                  record.change
                );

            }

          }


          let changeClass =
            "";


          if (
            record.change > 0
          ) {

            changeClass =
              "positive";

          }


          if (
            record.change < 0
          ) {

            changeClass =
              "negative";

          }


          return `

            <tr>

              <td>
                ${escapeHtml(
                  record.memberNo
                )}
              </td>

              <td>
                ${escapeHtml(
                  record.name || "―"
                )}
              </td>

              <td>
                ${
                  record.beforeRating !== null
                    ? record.beforeRating
                    : "―"
                }
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

        }
      )
      .join("");


  section.classList.remove(
    "hidden"
  );


  section.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


// ============================================================
// Supabase利用ログ
// ============================================================

async function saveUsageData(
  data
) {

  try {

    const {
      error
    } =
      await supabaseClient
        .from(
          "app_usage"
        )
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


// ============================================================
// ステータス
// ============================================================

function setStatus(
  message,
  isError = false
) {

  const status =
    document.getElementById(
      "status"
    );


  if (!status) {
    return;
  }


  status.textContent =
    message;


  status.classList.toggle(
    "error",
    isError
  );

}


// ============================================================
// HTMLエスケープ
// ============================================================

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    char => ({

      "&":
        "&amp;",

      "<":
        "&lt;",

      ">":
        "&gt;",

      '"':
        "&quot;",

      "'":
        "&#039;"

    }[char])
  );

}
