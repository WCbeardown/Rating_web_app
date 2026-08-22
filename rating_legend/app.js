// ============================================================
// レイティングレジェンドランキング
// ============================================================

let ratingData = [];

let minYear = 2000;
let maxYear = new Date().getFullYear();


// ============================================================
// 大会一覧
// ============================================================

const TOURNAMENTS = [
    "羽曳野",
    "羽曳野若葉",
    "神戸",
    "向日市",
    "HPC",
    "カミ"
];


// ============================================================
// 初期処理
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    loadData();

    setupTournamentSelection();

    document
        .getElementById("rankingButton")
        .addEventListener("click", createRanking);

});


// ============================================================
// CSV読み込み
//
// rating_legend と data が並列の場合
//
// メイン/
// ├─ data/
// │   └─ rating_data_all.csv
// │
// └─ rating_legend/
//     ├─ index.html
//     └─ app.js
//
// なので ../data/ を指定する。
// ============================================================

async function loadData() {

    const status =
        document.getElementById("dataStatus");

    status.textContent =
        "データ読み込み中...";

    status.style.color =
        "#555";

    // 試すパス
    const paths = [
        "../data/rating_data_all.csv",
        "../data/rating_data_all.csv?x=" + Date.now()
    ];

    let lastError = null;

    for (const path of paths) {

        try {

            console.log(
                "CSV読み込み開始:",
                path
            );

            const response =
                await fetch(
                    path,
                    {
                        cache: "no-store"
                    }
                );

            console.log(
                "HTTP status:",
                response.status
            );

            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }

            const buffer =
                await response.arrayBuffer();

            if (!buffer.byteLength) {

                throw new Error(
                    "CSVファイルが空です"
                );

            }

            // UTF-8を基本として読み込む
            let text =
                new TextDecoder(
                    "utf-8"
                ).decode(buffer);

            // BOM削除
            text =
                text.replace(
                    /^\uFEFF/,
                    ""
                );

            console.log(
                "CSV文字数:",
                text.length
            );

            console.log(
                "CSV先頭:",
                text.substring(
                    0,
                    300
                )
            );


            const rows =
                parseCSV(text);


            console.log(
                "CSV行数:",
                rows.length
            );


            if (!rows.length) {

                throw new Error(
                    "CSVにデータがありません"
                );

            }


            // ------------------------------------------------
            // 列名を確認
            // ------------------------------------------------

            const firstRow =
                rows[0];


            console.log(
                "CSV列名:",
                Object.keys(firstRow)
            );


            // 列名を正規化
            const normalizedRows =
                rows.map(row => {

                    const newRow = {};

                    Object.keys(row)
                        .forEach(key => {

                            const cleanKey =
                                String(key)
                                    .replace(
                                        /^\uFEFF/,
                                        ""
                                    )
                                    .trim();

                            newRow[cleanKey] =
                                row[key];

                        });

                    return newRow;

                });


            // ------------------------------------------------
            // 必須列確認
            // ------------------------------------------------

            const columns =
                Object.keys(
                    normalizedRows[0]
                );


            const dateColumn =
                findColumn(
                    columns,
                    [
                        "日付",
                        "日 付"
                    ]
                );


            const memberColumn =
                findColumn(
                    columns,
                    [
                        "会員番号",
                        "会員 番号"
                    ]
                );


            const placeColumn =
                findColumn(
                    columns,
                    [
                        "場所",
                        "大会",
                        "開催場所"
                    ]
                );


            console.log(
                "日付列:",
                dateColumn
            );

            console.log(
                "会員番号列:",
                memberColumn
            );

            console.log(
                "場所列:",
                placeColumn
            );


            if (!dateColumn) {

                throw new Error(
                    "CSVに「日付」列がありません"
                );

            }


            if (!memberColumn) {

                throw new Error(
                    "CSVに「会員番号」列がありません"
                );

            }


            if (!placeColumn) {

                throw new Error(
                    "CSVに「場所」列がありません"
                );

            }


            // ------------------------------------------------
            // データ変換
            // ------------------------------------------------

            const converted =
                normalizedRows

                    .map(row => {

                        const date =
                            parseDate(
                                row[dateColumn]
                            );


                        const memberId =
                            normalizeMemberId(
                                row[memberColumn]
                            );


                        const place =
                            normalizePlace(
                                row[placeColumn]
                            );


                        return {

                            date,

                            memberId,

                            place,

                            rawPlace:
                                row[placeColumn]

                        };

                    })


                    .filter(row =>

                        row.date !== null &&

                        Number.isFinite(
                            row.memberId
                        )

                    );


            console.log(
                "有効データ件数:",
                converted.length
            );


            if (!converted.length) {

                throw new Error(
                    "CSVは読み込めましたが、有効なデータがありません"
                );

            }


            ratingData =
                converted;


            // ------------------------------------------------
            // 年範囲
            // ------------------------------------------------

            minYear =
                Math.min(
                    ...ratingData.map(
                        row =>
                            row.date.getFullYear()
                    )
                );


            maxYear =
                Math.max(
                    ...ratingData.map(
                        row =>
                            row.date.getFullYear()
                    )
                );


            setupYearSelectors();


            status.textContent =
                `データ読み込み完了：${ratingData.length.toLocaleString()}件`;


            status.style.color =
                "#2e7d32";


            console.log(
                "CSV読み込み成功"
            );


            return;


        } catch (error) {

            console.error(
                "CSV読み込み失敗:",
                error
            );

            lastError =
                error;

        }

    }


    // ------------------------------------------------
    // 最終的に失敗した場合
    // ------------------------------------------------

    status.textContent =
        "データの読み込みに失敗しました。";


    status.style.color =
        "#c62828";


    const resultSection =
        document.getElementById(
            "resultSection"
        );


    if (resultSection) {

        resultSection.classList.remove(
            "hidden"
        );

    }


    const summary =
        document.getElementById(
            "summary"
        );


    if (summary) {

        summary.innerHTML = `

            <div class="error">

                データの読み込みに失敗しました。

                <br><br>

                <small>

                    読み込み先：

                    <br>

                    ../data/rating_data_all.csv

                    <br><br>

                    詳細：

                    ${escapeHtml(
                        lastError
                            ? lastError.message
                            : "不明"
                    )}

                    <br><br>

                    ブラウザの
                    「開発者ツール → Console」
                    に詳細が表示されます。

                </small>

            </div>

        `;

    }

}

function findColumn(
    columns,
    candidates
) {

    for (const candidate of candidates) {

        const found =
            columns.find(
                column =>
                    String(column)
                        .trim()
                        .replace(/\s+/g, "") ===
                    String(candidate)
                        .trim()
                        .replace(/\s+/g, "")
            );

        if (found) {

            return found;

        }

    }

    return null;

}
// ============================================================
// 年選択
// ============================================================

function setupYearSelectors() {

    const start =
        document.getElementById(
            "startYear"
        );

    const end =
        document.getElementById(
            "endYear"
        );


    start.innerHTML = "";
    end.innerHTML = "";


    for (
        let year = minYear;
        year <= maxYear;
        year++
    ) {

        const option1 =
            document.createElement(
                "option"
            );

        option1.value = year;
        option1.textContent = year;

        start.appendChild(
            option1
        );


        const option2 =
            document.createElement(
                "option"
            );

        option2.value = year;
        option2.textContent = year;

        end.appendChild(
            option2
        );

    }


    const currentYear =
        new Date().getFullYear();


    const defaultEnd =
        Math.min(
            currentYear,
            maxYear
        );


    const defaultStart =
        Math.max(
            minYear,
            defaultEnd - 5
        );


    start.value =
        String(defaultStart);

    end.value =
        String(defaultEnd);


    start.addEventListener(
        "change",
        () => {

            if (
                Number(start.value) >
                Number(end.value)
            ) {

                end.value =
                    start.value;

            }

        }
    );


    end.addEventListener(
        "change",
        () => {

            if (
                Number(end.value) <
                Number(start.value)
            ) {

                start.value =
                    end.value;

            }

        }
    );

}


// ============================================================
// 大会選択
//
// ALLをON
// → 全大会ON
//
// 個別を変更
// → ALLも自動更新
// ============================================================

function setupTournamentSelection() {

    const all =
        document.getElementById(
            "tournamentAll"
        );


    const radios =
        [
            ...document.querySelectorAll(
                'input[name="tournament"]'
            )
        ];


    all.addEventListener(
        "change",
        () => {

            if (all.checked) {

                radios
                    .filter(
                        radio =>
                            radio !== all
                    )
                    .forEach(
                        radio => {

                            radio.checked =
                                true;

                        }
                    );

            }

            else {

                // ALLをOFFにした場合、
                // 個別は一旦すべてOFF

                radios
                    .filter(
                        radio =>
                            radio !== all
                    )
                    .forEach(
                        radio => {

                            radio.checked =
                                false;

                        }
                    );

            }

            updateTournamentAppearance();

        }
    );


    radios
        .filter(
            radio =>
                radio !== all
        )
        .forEach(
            radio => {

                radio.addEventListener(
                    "change",
                    updateAllState
                );

            }
        );


    // 初期状態
    // ALL ON → 全大会ON

    if (all.checked) {

        radios
            .filter(
                radio =>
                    radio !== all
            )
            .forEach(
                radio => {

                    radio.checked =
                        true;

                }
            );

    }


    updateTournamentAppearance();

}


// ============================================================
// 個別大会変更時のALL状態
// ============================================================

function updateAllState() {

    const all =
        document.getElementById(
            "tournamentAll"
        );


    const radios =
        [
            ...document.querySelectorAll(
                'input[name="tournament"]'
            )
        ]
        .filter(
            radio =>
                radio !== all
        );


    const checkedCount =
        radios.filter(
            radio =>
                radio.checked
        ).length;


    // 全部ONならALLもON

    all.checked =
        checkedCount ===
        radios.length;


    updateTournamentAppearance();

}


// ============================================================
// 大会選択の見た目
// ============================================================

function updateTournamentAppearance() {

    const labels =
        [
            ...document.querySelectorAll(
                ".radio-item"
            )
        ];


    labels.forEach(
        label => {

            const input =
                label.querySelector(
                    "input"
                );


            label.style.background =
                input.checked
                    ? "#eaf3ff"
                    : "";


            label.style.borderColor =
                input.checked
                    ? "#1976d2"
                    : "";

        }
    );

}


// ============================================================
// 選択された大会を取得
// ============================================================

function getSelectedPlaces() {

    const all =
        document.getElementById(
            "tournamentAll"
        );


    // ALLなら6大会全部

    if (all.checked) {

        return [
            ...TOURNAMENTS
        ];

    }


    const selected =
        [
            ...document.querySelectorAll(
                'input[name="tournament"]:checked'
            )
        ]
        .filter(
            radio =>
                radio.value !== "ALL"
        );


    return selected.map(
        radio =>
            radio.value
    );

}


// ============================================================
// ランキング作成
// ============================================================

function createRanking() {

    if (!ratingData.length) {

        alert(
            "データを読み込めていません。"
        );

        return;

    }


    const startYear =
        Number(
            document.getElementById(
                "startYear"
            ).value
        );


    const endYear =
        Number(
            document.getElementById(
                "endYear"
            ).value
        );


    if (
        startYear >
        endYear
    ) {

        alert(
            "開始年は終了年以前にしてください。"
        );

        return;

    }


    const places =
        getSelectedPlaces();


    if (!places.length) {

        alert(
            "対象となる大会を1つ以上選択してください。"
        );

        return;

    }


    // ========================================================
    // 対象期間
    // ========================================================

    const startDate =
        new Date(
            startYear,
            0,
            1
        );


    const endDate =
        new Date(
            endYear,
            11,
            31,
            23,
            59,
            59,
            999
        );


    // ========================================================
    // 対象データ
    // ========================================================

    const targetRows =
        ratingData.filter(
            row =>

                row.date >=
                startDate &&

                row.date <=
                endDate &&

                places.includes(
                    row.place
                )

        );


    // ========================================================
    // 開催回数
    //
    // 「日付 × 場所」を1大会とする
    // ========================================================

    const tournamentSet =
        new Set();


    targetRows.forEach(
        row => {

            tournamentSet.add(
                makeTournamentKey(
                    row
                )
            );

        }
    );


    const tournamentCount =
        tournamentSet.size;


    // ========================================================
    // 会員ごとの参加回数
    //
    // 同じ会員が同じ大会に複数レコードある場合、
    // 1回として数える。
    // ========================================================

    const memberTournamentSet =
        new Map();


    targetRows.forEach(
        row => {

            const memberId =
                row.memberId;


            if (
                !memberTournamentSet.has(
                    memberId
                )
            ) {

                memberTournamentSet.set(
                    memberId,
                    new Set()
                );

            }


            memberTournamentSet
                .get(memberId)
                .add(
                    makeTournamentKey(
                        row
                    )
                );

        }
    );


    // ========================================================
    // ランキング
    // ========================================================

    const ranking =

        [
            ...memberTournamentSet.entries()
        ]

        .map(
            ([memberId, tournaments]) => {

                const count =
                    tournaments.size;


                const rate =
                    tournamentCount > 0

                        ? (
                            count /
                            tournamentCount *
                            100
                        )

                        : 0;


                return {

                    memberId,

                    count,

                    rate

                };

            }
        )

        .sort(
            (a, b) => {

                // 参加回数の多い順

                if (
                    b.count !==
                    a.count
                ) {

                    return (
                        b.count -
                        a.count
                    );

                }


                // 同数なら会員番号順

                return (
                    a.memberId -
                    b.memberId
                );

            }
        )

        .slice(
            0,
            20
        );


    displayResult(
        startYear,
        endYear,
        places,
        tournamentCount,
        ranking
    );

}


// ============================================================
// 大会キー
// ============================================================

function makeTournamentKey(row) {

    return (
        formatDate(row.date) +
        "|" +
        row.place
    );

}


// ============================================================
// 結果表示
// ============================================================

function displayResult(

    startYear,
    endYear,
    places,
    tournamentCount,
    ranking

) {

    const resultSection =
        document.getElementById(
            "resultSection"
        );


    const summary =
        document.getElementById(
            "summary"
        );


    const table =
        document.getElementById(
            "rankingTable"
        );


    resultSection.classList.remove(
        "hidden"
    );


    // ========================================================
    // 大会名
    // ========================================================

    const placeText =
        places.join("、");


    summary.innerHTML = `

        <div>

            ${startYear}年から
            ${endYear}年の
            レイティング大会

        </div>

        <div class="places">

            （${escapeHtml(
                placeText
            )}）

        </div>

        <div>

            の開催回数

            <span class="count">

                ${tournamentCount}

            </span>

            回

        </div>

    `;


    // ========================================================
    // ランキングなし
    // ========================================================

    if (!ranking.length) {

        table.innerHTML = `

            <div class="error">

                対象期間・大会に
                参加した会員がいません。

            </div>

        `;

        resultSection.scrollIntoView({
            behavior: "smooth"
        });

        return;

    }


    // ========================================================
    // 表
    // ========================================================

    let html = `

        <div class="table-wrapper">

            <table>

                <thead>

                    <tr>

                        <th>
                            順位
                        </th>

                        <th>
                            会員番号
                        </th>

                        <th>
                            参加回数
                        </th>

                        <th>
                            参加率（％）
                        </th>

                    </tr>

                </thead>

                <tbody>

    `;


    ranking.forEach(
        (item, index) => {

            const rank =
                index + 1;


            let rankClass =
                "";


            if (rank === 1) {

                rankClass =
                    "rank-1";

            }

            else if (rank === 2) {

                rankClass =
                    "rank-2";

            }

            else if (rank === 3) {

                rankClass =
                    "rank-3";

            }


            html += `

                <tr>

                    <td
                        class="rank ${rankClass}"
                    >

                        ${rank}

                    </td>

                    <td>

                        ${formatMemberId(
                            item.memberId
                        )}

                    </td>

                    <td>

                        ${item.count}回

                    </td>

                    <td>

                        ${item.rate.toFixed(1)}%

                    </td>

                </tr>

            `;

        }
    );


    html += `

                </tbody>

            </table>

        </div>

    `;


    table.innerHTML =
        html;


    // 結果へ移動

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


// ============================================================
// 場所の正規化
// ============================================================

function normalizePlace(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    let place =
        String(value)
            .normalize("NFKC")
            .trim();


    // 全角・半角スペースを削除

    place =
        place.replace(
            /\s+/g,
            ""
        );


    // 長い名前から先に判定

    if (
        place.includes(
            "羽曳野若葉"
        )
    ) {

        return "羽曳野若葉";

    }


    if (
        place.includes(
            "羽曳野"
        )
    ) {

        return "羽曳野";

    }


    if (
        place.includes(
            "神戸"
        )
    ) {

        return "神戸";

    }


    if (
        place.includes(
            "向日市"
        )
    ) {

        return "向日市";

    }


    if (
        place
            .toUpperCase()
            .includes("HPC")
    ) {

        return "HPC";

    }


    if (
        place.includes(
            "カミ"
        )
    ) {

        return "カミ";

    }


    return place;

}


// ============================================================
// 会員番号
// ============================================================

function normalizeMemberId(value) {

    let text =
        String(
            value ?? ""
        )
        .normalize("NFKC")
        .replace(
            /\D/g,
            ""
        );


    if (!text) {

        return NaN;

    }


    if (
        text.length >= 8
    ) {

        text =
            text.slice(-7);

    }


    return Number(
        text
    );

}


function formatMemberId(id) {

    return Number(
        id
    ).toString();

}


// ============================================================
// 日付
// ============================================================

function parseDate(value) {

    if (!value) {

        return null;

    }


    const text =
        String(value)
            .normalize("NFKC")
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
        date.getFullYear() !==
            year ||

        date.getMonth() !==
            month - 1 ||

        date.getDate() !==
            day
    ) {

        return null;

    }


    return date;

}


function formatDate(date) {

    return (

        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ) +
        "-" +
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )

    );

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


        // ""

        if (
            char === '"' &&
            quoted &&
            next === '"'
        ) {

            cell += '"';

            i++;

            continue;

        }


        // "

        if (
            char === '"'
        ) {

            quoted =
                !quoted;

            continue;

        }


        // カンマ

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


        // 改行

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
                        x.trim() !== ""
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
        cell !== "" ||
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
                header =>
                    header.trim()
            );


    return rows.map(
        values => {

            const object = {};


            headers.forEach(
                (header, index) => {

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
// HTMLエスケープ
// ============================================================

function escapeHtml(value) {

    return String(
        value
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