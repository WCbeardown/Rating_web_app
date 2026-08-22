let data = [];

const classes = ["A", "B", "C", "D"];

const positions = [
    { part: "1", rank: "1", label: "1部優勝" },
    { part: "1", rank: "2", label: "1部準優勝" },
    { part: "1", rank: "3", label: "1部3位" },
    { part: "2", rank: "1", label: "2部優勝" },
    { part: "2", rank: "2", label: "2部準優勝" },
    { part: "2", rank: "3", label: "2部3位" }
];

const $ = id => document.getElementById(id);


// ----------------------------------------
// 起動
// ----------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    createCheckboxes();

    $("searchButton").addEventListener(
        "click",
        searchChampions
    );

    loadCSV();

});


// ----------------------------------------
// チェックボックス作成
// ----------------------------------------

function createCheckboxes() {

    const container = $("checkboxes");

    // ALL
    const allItem = document.createElement("label");
    allItem.className = "check-item all-item";

    allItem.innerHTML = `
        <input
            type="checkbox"
            id="check-all"
            checked
        >
        <strong>ALL</strong>
    `;

    container.appendChild(allItem);


    // A～D × 1・2部 × 1～3位
    for (const cls of classes) {

        const classTitle = document.createElement("div");
        classTitle.className = "class-title";
        classTitle.textContent = `${cls}クラス`;

        container.appendChild(classTitle);


        for (const pos of positions) {

            const label = document.createElement("label");

            label.className = "check-item";

            const id =
                `check-${cls}-${pos.part}-${pos.rank}`;

            label.innerHTML = `
                <input
                    type="checkbox"
                    class="condition-check"
                    id="${id}"
                    data-class="${cls}"
                    data-part="${pos.part}"
                    data-rank="${pos.rank}"
                    checked
                >
                ${pos.label}
            `;

            container.appendChild(label);

        }

    }


    // ALL のON/OFF
    const allCheck = $("check-all");

    allCheck.addEventListener("change", () => {

        document
            .querySelectorAll(".condition-check")
            .forEach(cb => {
                cb.checked = allCheck.checked;
            });

    });


    // 個別チェックを変更した場合
    document
        .querySelectorAll(".condition-check")
        .forEach(cb => {

            cb.addEventListener("change", () => {

                const checks =
                    [...document.querySelectorAll(".condition-check")];

                allCheck.checked =
                    checks.every(x => x.checked);

            });

        });

}


// ----------------------------------------
// CSV読み込み
// ----------------------------------------

async function loadCSV() {

    try {

        const response =
            await fetch("../data/winner_list.csv", {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                `CSV読み込み失敗（HTTP ${response.status}）`
            );
        }

        const text = await response.text();

        data = parseCSV(text);

        if (!data.length) {
            throw new Error(
                "入賞者データが空です。"
            );
        }

        $("status").className = "status ok";

        $("status").textContent =
            `データ読み込み完了：${data.length.toLocaleString()}件`;

    }

    catch (e) {

        $("status").className = "status error";

        $("status").textContent =
            "データを読み込めませんでした：" +
            e.message;

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
        const n = text[i + 1];

        if (c === '"' && quoted && n === '"') {
            cell += '"';
            i++;
            continue;
        }

        if (c === '"') {
            quoted = !quoted;
            continue;
        }

        if (c === "," && !quoted) {
            row.push(cell);
            cell = "";
            continue;
        }

        if (
            (c === "\n" || c === "\r")
            && !quoted
        ) {

            if (c === "\r" && n === "\n") {
                i++;
            }

            row.push(cell);
            cell = "";

            if (
                row.some(
                    x => x.trim() !== ""
                )
            ) {
                rows.push(row);
            }

            row = [];

            continue;
        }

        cell += c;
    }

    if (cell !== "" || row.length) {
        row.push(cell);
        rows.push(row);
    }

    const headers =
        rows.shift().map(x => x.trim());

    return rows.map(r =>
        Object.fromEntries(
            headers.map(
                (h, i) =>
                    [h, (r[i] ?? "").trim()]
            )
        )
    );

}


// ----------------------------------------
// チャンピオン検索
// ----------------------------------------

function searchChampions() {

    if (!data.length) {

        $("status").className = "status error";

        $("status").textContent =
            "入賞者データが読み込まれていません。";

        return;
    }


    // 選択された条件
    const selected = [
        ...document.querySelectorAll(
            ".condition-check:checked"
        )
    ];


    if (selected.length === 0) {

        $("status").className = "status error";

        $("status").textContent =
            "少なくとも1つの条件を選択してください。";

        return;
    }


    // 選択条件を作る
    const conditions =
        selected.map(cb => ({
            className:
                cb.dataset.class.toUpperCase(),

            part:
                cb.dataset.part,

            rank:
                cb.dataset.rank
        }));


    // ------------------------------------
    // 条件に該当する入賞データだけ抽出
    // ------------------------------------

    const filtered =
        data.filter(row => {

            const rowClass =
                (row["クラス"] || "")
                    .trim()
                    .toUpperCase();

            const rowPart =
                String(row["部"] || "").trim();

            const rowRank =
                String(row["位"] || "").trim();


            return conditions.some(condition =>

                rowClass.includes(
                    condition.className
                )

                &&

                rowPart === condition.part

                &&

                rowRank === condition.rank

            );

        });


    // ------------------------------------
    // 名前ごとに集計
    // ------------------------------------

    const people = new Map();


    for (const row of filtered) {

        const name =
            (row["名前"] || "").trim();

        if (!name) {
            continue;
        }


        if (!people.has(name)) {

            people.set(name, {
                name: name,
                count: 0,
                teams: new Set()
            });

        }


        const person =
            people.get(name);

        person.count++;


        const team =
            (row["チーム名"] || "").trim();

        if (team) {
            person.teams.add(team);
        }

    }


    // ------------------------------------
    // ランキング
    // ------------------------------------

    const ranking =
        [...people.values()]
            .sort((a, b) => {

                // 入賞回数の多い順
                if (b.count !== a.count) {
                    return b.count - a.count;
                }

                // 同数なら名前順
                return a.name.localeCompare(
                    b.name,
                    "ja"
                );

            })
            .slice(0, 20);


    displayResults(ranking);

}


// ----------------------------------------
// 結果表示
// ----------------------------------------

function displayResults(ranking) {

    $("results")
        .classList
        .remove("hidden");


    if (!ranking.length) {

        $("resultTable").innerHTML =
            `<div class="empty">
                該当する入賞者はいません。
             </div>`;

        return;
    }


    let html = `
        <table>
            <thead>
                <tr>
                    <th>順位</th>
                    <th>氏名</th>
                    <th>チーム名</th>
                    <th>入賞回数</th>
                </tr>
            </thead>
            <tbody>
    `;


    ranking.forEach((person, index) => {

        const teams =
            [...person.teams].join(" / ");


        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${esc(person.name)}</td>
                <td>${esc(teams)}</td>
                <td>${person.count}</td>
            </tr>
        `;

    });


    html += `
            </tbody>
        </table>
    `;


    $("resultTable").innerHTML = html;

}


// ----------------------------------------
// HTMLエスケープ
// ----------------------------------------

function esc(value) {

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