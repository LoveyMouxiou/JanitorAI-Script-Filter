const fileInput = document.getElementById("file");
const table = document.getElementById("table");
const tableBody = table.tBodies[0];
const summary = document.getElementById("summary");
const idsInput = document.getElementById("ids");
const applyButton = document.getElementById("apply");
const allButton = document.getElementById("all");
const noneButton = document.getElementById("none");
const downloadButton = document.getElementById("download");

let entries = [];
let originalData = null;
let removeIndexes = new Set();
let fileName = "lorebook";

function getEntryId(entry, index) {
    return String(entry.id ?? index + 1);
}

function getEntryKeys(entry) {
    const keys = entry.key ?? entry.keys ?? [];

    if (Array.isArray(keys)) {
        return keys.join(", ");
    }

    return String(keys);
}

function updateSummary() {
    const keptCount = entries.length - removeIndexes.size;

    summary.textContent =
        `${entries.length} entries, ${removeIndexes.size} marked for removal, ${keptCount} kept`;
}

function renderEntries() {
    tableBody.replaceChildren();

    entries.forEach(function (entry, index) {
        const row = tableBody.insertRow();
        const checkboxCell = row.insertCell();
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = removeIndexes.has(index);
        row.className = checkbox.checked ? "marked" : "";

        checkbox.addEventListener("change", function () {
            if (checkbox.checked) {
                removeIndexes.add(index);
            } else {
                removeIndexes.delete(index);
            }

            row.className = checkbox.checked ? "marked" : "";
            updateSummary();
        });

        checkboxCell.append(checkbox);
        row.insertCell().textContent = getEntryId(entry, index);
        row.insertCell().textContent = getEntryKeys(entry);
        row.insertCell().textContent = entry.comment ?? entry.name ?? "";
    });

    updateSummary();
}

function parseIdList(text) {
    const ids = new Set();
    const parts = text.split(/[\s,]+/).filter(Boolean);

    parts.forEach(function (part) {
        const range = part.match(/^(\d+)-(\d+)$/);

        if (!range) {
            ids.add(part);
            return;
        }

        const first = Number(range[1]);
        const last = Number(range[2]);
        const start = Math.min(first, last);
        const end = Math.max(first, last);

        for (let id = start; id <= end; id++) {
            ids.add(String(id));
        }
    });

    return ids;
}

function markEntriesById() {
    const ids = parseIdList(idsInput.value);

    entries.forEach(function (entry, index) {
        if (ids.has(getEntryId(entry, index))) {
            removeIndexes.add(index);
        }
    });

    idsInput.value = "";
    renderEntries();
}

function selectAllEntries() {
    removeIndexes = new Set(entries.map(function (_, index) {
        return index;
    }));

    renderEntries();
}

function clearSelection() {
    removeIndexes.clear();
    renderEntries();
}

function downloadFilteredFile() {
    const keptEntries = entries.filter(function (_, index) {
        return !removeIndexes.has(index);
    });

    let result = keptEntries;

    if (!Array.isArray(originalData)) {
        result = {
            ...originalData,
            entries: keptEntries
        };
    }

    const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName + "_filtered.json";
    link.click();

    URL.revokeObjectURL(url);
}

async function loadLorebook() {
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    try {
        const data = JSON.parse(await file.text());

        if (Array.isArray(data)) {
            entries = data;
            originalData = data;
        } else if (data && Array.isArray(data.entries)) {
            entries = data.entries;
            originalData = data;
        } else {
            throw new Error(
                'Expected an array or an object with an "entries" array.'
            );
        }

        fileName = file.name.replace(/\.json$/i, "") || "lorebook";
        removeIndexes.clear();
        table.hidden = false;
        idsInput.disabled = false;
        applyButton.disabled = false;
        allButton.disabled = false;
        noneButton.disabled = false;
        downloadButton.disabled = false;

        renderEntries();
    } catch (error) {
        alert("Could not load JSON: " + error.message);
    }
}

fileInput.addEventListener("change", loadLorebook);
applyButton.addEventListener("click", markEntriesById);
allButton.addEventListener("click", selectAllEntries);
noneButton.addEventListener("click", clearSelection);
downloadButton.addEventListener("click", downloadFilteredFile);

idsInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        markEntriesById();
    }
});
