const DEFAULT_MEMBER = 1802222;
const MIN_MEMBER = 50000;
const MAX_MEMBER = 3000000;
const DEFAULT_START_YEAR = 2019;

let allData = [];
let memberCount = 2;
let ratingChart = null;

let memberList;
let addMemberButton;
let memberInputs = [];
let startYearInput;
let endYearInput;
let searchButton;
let resetButton;
let statusEl;
let resultsEl;
let lastUpdatedEl;

document.addEventListener("DOMContentLoaded", () => {
  memberList = document.getElementById("memberList");
  addMemberButton = document.getElementById("addMemberButton");
  startYearInput = document.getElementById("startYear");
  endYearInput = document.getElementById("endYear");
  searchButton = document.getElementById("searchButton");
  resetButton = document.getElementById("resetButton");
  statusEl = document.getElementById("status");
  resultsEl = document.getElementById("results");
  lastUpdatedEl = document.getElementById("lastUpdated");

  buildMemberInputs(2);

  searchButton.addEventListener("click", () => renderApp(true));

  addMemberButton.addEventListener("click", () => {
    if (memberCount >= 6) return;

    // 現在入力されている会員番号を保存
    const values = memberInputs.map(input => input.value);

    memberCount += 1;
    buildMemberInputs(memberCount);

    // 既存の入力値を復元
    memberInputs.forEach((input, i) => {
      input.value = values[i] ?? DEFAULT_MEMBER;
    });
  });

  resetButton.addEventListener("click", () => {
    memberCount = 2;
    buildMemberInputs(2);
    startYearInput.value = DEFAULT_START_YEAR;
    endYearInput.value = getLatestYear();
    renderApp(false);
  });

  loadData();
});

async function loadData() {
  try {
    setStatus("CSVを読み込んでいます…");

    // GitHub Pagesでは /Rating_web_app/rating/ から実行されるため、
    // 現在のページ位置を基準に ../data/ を組み立てる。
    const csvUrl = new URL("../data/rating_data_all.csv", window.location.href).href;

    const response = await fetch(csvUrl, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`CSV読み込み失敗（HTTP ${response.status}）`);
    }

    const text = await response.text();

    if (!text || text.length < 20) {
      throw new Error("CSVファイルが空、または正しく取得できませんでした。");
    }

    allData = parseCSV(text)
      .map(row => ({
        place: row["場所"] ?? "",
        round: row["回"] ?? "",
        date: parseDate(row["日付"]),
        member: Number(String(row["会員番号"] ?? "").replace(/,/g, "")),
        rating: Number(String(row["レイティング"] ?? "").replace(/,/g, ""))
      }))
      .filter(row =>
        row.date &&
        Number.isFinite(row.member) &&
        Number.isFinite(row.rating)
      )
      .sort((a, b) => a.date - b.date);

    if (!allData.length) {
      throw new Error(
        "CSVは取得できましたが、有効なデータを読み取れませんでした。"
      );
    }

    const latest = allData[allData.length - 1].date;

    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = `最終更新日：${formatDate(latest)}`;
    }

    if (endYearInput) {
      endYearInput.value = latest.getFullYear();
    }

    setStatus(
      `データ読み込み完了：${allData.length.toLocaleString("ja-JP")}件`,
      "ok"
    );

    // データ読み込み完了後も初期画面はトップのまま。
    renderApp(false);

  } catch (error) {
    console.error("Rating app CSV error:", error);

    setStatus(
      `データを読み込めませんでした。${error.message}`,
      "error"
    );
  }
}

function renderApp(shouldScroll = false) {
  if (!allData.length) return;

  const members = memberInputs.map(input => Number(input.value)).filter(Number.isFinite);
  const startYear = Number(startYearInput.value);
  const endYear = Number(endYearInput.value);

  if (members.length === 0) {
    setStatus("会員番号を1人以上入力してください。", "error");
    return;
  }
  if (members.some(n => n < MIN_MEMBER || n > MAX_MEMBER)) {
    setStatus(`会員番号は ${MIN_MEMBER.toLocaleString()} ～ ${MAX_MEMBER.toLocaleString()} の範囲で入力してください。`, "error");
    return;
  }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    setStatus("開始年は終了年以下にしてください。", "error");
    return;
  }

  const selected = members.map(member => {
    const rows = allData.filter(row => row.member === member);
    return { member, rows };
  });

  const foundCount = selected.filter(x => x.rows.length > 0).length;
  setStatus(`${foundCount}人分のデータを表示しています。`, "ok");
  resultsEl.classList.remove("hidden");

  renderChart(selected, startYear, endYear);
  renderAverageTable(selected, startYear, endYear);
  renderStatsTable(selected);
  renderDetailTables(selected);

  if (shouldScroll) resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderChart(selected, startYear, endYear) {
  const ctx = document.getElementById("ratingChart").getContext("2d");
  if (ratingChart) ratingChart.destroy();

  const palette = ["#dc2626", "#16a34a", "#2563eb", "#0891b2", "#c026d3", "#ca8a04"];

  const datasets = selected.map((person, index) => ({
    label: String(person.member),
    data: person.rows
      .filter(row => row.date.getFullYear() >= startYear && row.date.getFullYear() <= endYear)
      .map(row => ({ x: row.date.getTime(), y: row.rating })),
    borderColor: palette[index],
    backgroundColor: palette[index],
    pointRadius: 3,
    pointHoverRadius: 6,
    borderWidth: 2,
    tension: 0.05,
    spanGaps: false
  })).filter(dataset => dataset.data.length > 0);

  ratingChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true, boxWidth: 8, padding: 14 }
        },
        tooltip: {
          callbacks: {
            title(items) {
              return items.length ? formatDate(new Date(items[0].parsed.x)) : "";
            },
            label(context) {
              return `${context.dataset.label}: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          min: new Date(startYear, 0, 1).getTime(),
          max: new Date(endYear, 11, 31).getTime(),

          // 毎年必ず縦線を出すため、毎年1月1日に固定目盛を作る
          grid: {
            display: true,
            drawOnChartArea: true,
            drawTicks: true,
            color: "rgba(37, 99, 235, 0.25)",
            lineWidth: 1
          },

          ticks: {
            autoSkip: false,
            font: {
              size: 11
            },
            maxRotation: 0,
            minRotation: 0,

            // スマホでは年表示を2年おきにするが、縦線は毎年残す
            callback(value) {
              const year = new Date(value).getFullYear();
              const isSmallScreen = window.innerWidth <= 600;

              if (isSmallScreen && ((year - startYear) % 2 !== 0)) {
                return "";
              }
              return year + "年";
            }
          },

          afterBuildTicks(scale) {
            const ticks = [];
            for (let year = startYear; year <= endYear; year++) {
              ticks.push({
                value: new Date(year, 0, 1).getTime()
              });
            }
            scale.ticks = ticks;
          }
        },
        y: {
          grid: { color: "rgba(15, 23, 42, .10)" },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

function renderAverageTable(selected, startYear, endYear) {
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  let html = `<table><thead><tr><th>会員番号</th>${years.map(y => `<th>${y}</th>`).join("")}</tr></thead><tbody>`;

  for (const person of selected) {
    if (!person.rows.length) continue;
    html += `<tr><td>${person.member}</td>`;
    for (const year of years) {
      const values = person.rows.filter(row => row.date.getFullYear() === year).map(row => row.rating);
      const avg = values.length ? Math.trunc(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      html += `<td>${avg || "0"}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";

  document.getElementById("averageTable").innerHTML =
    html.includes("<td>") ? html : '<div class="empty">該当するデータがありません。</div>';
}

function renderStatsTable(selected) {
  const headers = ["会員番号", "出場回数", "最低値", "最低日", "最高値", "最高日", "最大UP", "UP日", "最大DOWN", "DOWN日"];
  let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>`;

  for (const person of selected) {
    if (!person.rows.length) continue;

    let minRow = person.rows[0];
    let maxRow = person.rows[0];
    let maxUp = 0, maxDown = 0;
    let upDate = new Date("2000-01-01");
    let downDate = new Date("2000-01-01");

    for (const row of person.rows) {
      if (row.rating < minRow.rating) minRow = row;
      if (row.rating > maxRow.rating) maxRow = row;
    }

    for (let i = 0; i < person.rows.length - 1; i++) {
      const diff = person.rows[i + 1].rating - person.rows[i].rating;
      if (diff > maxUp) {
        maxUp = diff;
        upDate = person.rows[i + 1].date;
      } else if (diff < maxDown) {
        maxDown = diff;
        downDate = person.rows[i + 1].date;
      }
    }

    const cells = [
      person.member,
      person.rows.length,
      minRow.rating,
      formatDateTwoLines(minRow.date),
      maxRow.rating,
      formatDateTwoLines(maxRow.date),
      maxUp,
      formatDateTwoLines(upDate),
      maxDown,
      formatDateTwoLines(downDate)
    ];
    html += `<tr>${cells.map((v, i) => [3,5,7,9].includes(i) ? `<td>${v}</td>` : `<td>${escapeHtml(String(v))}</td>`).join("")}</tr>`;
  }

  html += "</tbody></table>";
  document.getElementById("statsTable").innerHTML =
    html.includes("<td>") ? html : '<div class="empty">該当するデータがありません。</div>';
}

function renderDetailTables(selected) {
  const container = document.getElementById("detailTables");
  container.innerHTML = "";

  selected.forEach((person, index) => {
    const block = document.createElement("div");
    block.className = "person-block";

    const title = document.createElement("h3");
    title.className = "person-title";
    title.textContent = `${index + 1}人目の詳細データ`;
    block.appendChild(title);

    if (!person.rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "該当するデータがありません。";
      block.appendChild(empty);
      container.appendChild(block);
      return;
    }

    const sorted = [...person.rows].sort((a, b) => b.date - a.date);
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr><th>場所</th><th>回</th><th>日付</th><th>レイティング</th></tr>
      </thead>
      <tbody>
        ${sorted.map(row => `
          <tr>
            <td>${escapeHtml(row.place)}</td>
            <td>${escapeHtml(String(row.round))}</td>
            <td>${formatDateTwoLines(row.date)}</td>
            <td>${row.rating}</td>
          </tr>`).join("")}
      </tbody>`;
    wrap.appendChild(table);
    block.appendChild(wrap);
    container.appendChild(block);
  });
}

function buildMemberInputs(count) {
  if (!memberList) return;

  const currentValues = memberInputs.map(input => input.value);

  memberList.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.className = "member-row";

    const label = document.createElement("label");
    label.textContent = `${i + 1}人目`;

    const input = document.createElement("input");
    input.className = "member-input";
    input.type = "number";
    input.min = "50000";
    input.max = "3000000";
    input.value = currentValues[i] ?? DEFAULT_MEMBER;

    label.appendChild(input);
    row.appendChild(label);

    if (count > 2) {
      const removeButton = document.createElement("button");
      removeButton.className = "remove-member";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.title = `${i + 1}人目を削除`;

      removeButton.addEventListener("click", () => {
        const values = memberInputs.map(x => x.value);
        values.splice(i, 1);

        memberCount = Math.max(2, values.length);
        buildMemberInputs(memberCount);

        memberInputs.forEach((input, index) => {
          input.value = values[index] ?? DEFAULT_MEMBER;
        });
      });

      row.appendChild(removeButton);
    }

    memberList.appendChild(row);
  }

  memberInputs = [...memberList.querySelectorAll(".member-input")];

  if (addMemberButton) {
    addMemberButton.disabled = count >= 6;
    addMemberButton.textContent = count >= 6 ? "最大6人" : "＋ 会員を追加";
  }
}

function getLatestYear() {
  return allData.length ? allData[allData.length - 1].date.getFullYear() : new Date().getFullYear();
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\//g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatDateTwoLines(date) {
  return `${date.getFullYear()}年<br>${date.getMonth() + 1}月${date.getDate()}日`;
}

// CSV parser: quoted fields, commas, CR/LF and double quotesに対応。
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).filter(r => r.some(v => v !== "")).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (r[i] ?? "").trim());
    return obj;
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}
