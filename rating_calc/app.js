// レイティング計算
// 「自分のリーグ分析」と同じレイティング増減表を使用。
// 参考: Rating_web_app/match-rating/app.js の POINTS

const POINTS = [
  [12,  8,  8],
  [37,  7, 10],
  [62,  6, 13],
  [87,  5, 16],
  [112, 4, 20],
  [137, 3, 25],
  [162, 2, 30],
  [187, 2, 35],
  [212, 1, 40],
  [237, 1, 45],
  [99999, 0, 50]
];

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  createMatchRows();
  $("calcButton").addEventListener("click", calculate);
});

function createMatchRows() {
  const tbody = $("matchRows");

  for (let i = 1; i <= 10; i++) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="match-no">${i}</td>
      <td>
        <input
          id="opponent-${i}"
          class="opponent-input"
          type="number"
          min="0"
          max="9999"
          step="1"
          inputmode="numeric"
          placeholder="レイティング"
        >
      </td>
      <td>
        <select id="result-${i}" class="result-select">
          <option value="">未入力</option>
          <option value="win">勝ち</option>
          <option value="loss">負け</option>
        </select>
      </td>
    `;

    tbody.appendChild(tr);
  }
}

function getChange(myRating, opponentRating, result) {
  const diff = Math.abs(myRating - opponentRating);

  const row = POINTS.find(p => diff <= p[0]);

  if (!row) return 0;

  const winPoints = row[1];
  const lossPoints = row[2];

  if (result === "win") {
    return myRating >= opponentRating ? winPoints : lossPoints;
  }

  return myRating >= opponentRating ? -lossPoints : -winPoints;
}

function formatSigned(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
}

function calculate() {
  const myRating = Number($("myRating").value);

  if (!Number.isFinite(myRating) || myRating < 0) {
    showError("自分のレイティングを入力してください。");
    return;
  }

  const matches = [];

  for (let i = 1; i <= 10; i++) {
    const ratingText = $(`opponent-${i}`).value.trim();
    const result = $(`result-${i}`).value;

    // 両方空欄なら、その試合は無視
    if (ratingText === "" && result === "") continue;

    if (ratingText === "" || result === "") {
      showError(`${i}試合目の「相手のレイティング」と「勝敗」を両方入力してください。`);
      return;
    }

    const opponentRating = Number(ratingText);

    if (!Number.isFinite(opponentRating) || opponentRating < 0) {
      showError(`${i}試合目の相手レイティングが正しくありません。`);
      return;
    }

    matches.push({
      no: i,
      opponentRating,
      result
    });
  }

  if (matches.length === 0) {
    showError("少なくとも1試合入力してください。");
    return;
  }

  const details = matches.map(match => {
    const diff = match.opponentRating - myRating;
    const change = getChange(myRating, match.opponentRating, match.result);

    return {
      ...match,
      diff,
      change
    };
  });

  const totalChange = details.reduce((sum, m) => sum + m.change, 0);
  const wins = details.filter(m => m.result === "win").length;
  const losses = details.filter(m => m.result === "loss").length;
  const finalRating = myRating + totalChange;

  renderResults(myRating, details, totalChange, finalRating, wins, losses);
}

function renderResults(myRating, details, totalChange, finalRating, wins, losses) {
  const rows = details.map(m => {
    const diffText = formatSigned(m.diff);
    const changeText = formatSigned(m.change);
    const resultText = m.result === "win" ? "勝ち" : "負け";

    return `
      <tr>
        <td>${m.no}</td>
        <td>${m.opponentRating}</td>
        <td>${diffText}</td>
        <td>${resultText}</td>
        <td class="${m.change >= 0 ? "positive" : "negative"}">${changeText}</td>
      </tr>
    `;
  }).join("");

  $("result").innerHTML = `
    <div class="summary">
      <div class="summary-item">
        <span>開始レイティング</span>
        <strong>${myRating}</strong>
      </div>
      <div class="summary-item">
        <span>対戦成績</span>
        <strong>${wins}勝 ${losses}敗</strong>
      </div>
      <div class="summary-item final">
        <span>その日の最終結果</span>
        <strong class="${totalChange >= 0 ? "positive" : "negative"}">
          ${formatSigned(totalChange)}
        </strong>
      </div>
      <div class="summary-item">
        <span>終了後レイティング</span>
        <strong>${finalRating}</strong>
      </div>
    </div>

    <div class="table-wrap result-table-wrap">
      <table>
        <thead>
          <tr>
            <th>試合</th>
            <th>相手</th>
            <th>自分との差</th>
            <th>結果</th>
            <th>増減</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <p class="result-note">
      「自分との差」は「相手のレイティング − 自分のレイティング」です。
      プラスなら相手が高く、マイナスなら相手が低いことを示します。
    </p>
  `;

  $("resultCard").classList.remove("hidden");
  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(message) {
  $("resultCard").classList.remove("hidden");

  $("result").innerHTML = `
    <div class="error">${escapeHtml(message)}</div>
  `;

  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}
