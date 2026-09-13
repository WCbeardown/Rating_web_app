// 利用状況分析

const SUPABASE_URL = "https://hbzjahdvxvlakbuiupcq.supabase.co";

// rating_calc/app.js に入れている
// Supabase Publishable Key と同じものを入れてください。
const SUPABASE_PUBLISHABLE_KEY = "ここにPublishable Keyを貼る";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

document.addEventListener("DOMContentLoaded", loadAnalytics);

async function loadAnalytics() {
  const { data, error } = await supabaseClient
    .from("app_usage")
    .select("created_at, app_name, action, input_data")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("データ取得エラー:", error);
    showError("データを取得できませんでした。");
    return;
  }

  renderSummary(data);
  renderAppStats(data);
  renderDailyStats(data);
  renderRecentStats(data);
}

function renderSummary(data) {
  $("totalCount").textContent = data.length;

  const apps = new Set(data.map(row => row.app_name));
  $("appCount").textContent = apps.size;

  const today = new Date().toLocaleDateString("ja-JP");

  const todayCount = data.filter(row => {
    return new Date(row.created_at).toLocaleDateString("ja-JP") === today;
  }).length;

  $("todayCount").textContent = todayCount;
}

function renderAppStats(data) {
  const counts = {};

  data.forEach(row => {
    counts[row.app_name] = (counts[row.app_name] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    $("appStats").textContent = "まだ利用データがありません。";
    return;
  }

  const max = entries[0][1];

  $("appStats").innerHTML = entries.map(([app, count]) => {
    const percent = Math.max(5, count / max * 100);

    return `
      <div class="app-row">
        <div class="app-name">${escapeHtml(app)}</div>
        <div class="bar-area">
          <div class="bar" style="width:${percent}%"></div>
        </div>
        <div class="app-count">${count}回</div>
      </div>
    `;
  }).join("");
}

function renderDailyStats(data) {
  const counts = {};

  data.forEach(row => {
    const date = new Date(row.created_at)
      .toLocaleDateString("ja-JP");

    counts[date] = (counts[date] || 0) + 1;
  });

  const entries = Object.entries(counts);

  $("dailyStats").innerHTML = entries.map(([date, count]) => `
    <tr>
      <td>${escapeHtml(date)}</td>
      <td>${count}</td>
    </tr>
  `).join("");
}

function renderRecentStats(data) {
  $("recentStats").innerHTML = data.slice(0, 20).map(row => {
    const date = new Date(row.created_at);

    const dateText =
      date.toLocaleDateString("ja-JP") +
      " " +
      date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
      });

    return `
      <tr>
        <td>${escapeHtml(dateText)}</td>
        <td>${escapeHtml(row.app_name)}</td>
        <td>${escapeHtml(row.action || "")}</td>
      </tr>
    `;
  }).join("");
}

function showError(message) {
  $("appStats").innerHTML =
    `<div class="error">${escapeHtml(message)}</div>`;
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]);
}
