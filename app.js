const fileInput = document.getElementById("file");
const table = document.getElementById("table");
const tableBody = table.tBodies[0];
const summary = document.getElementById("summary");
const idsInput = document.getElementById("ids");
const applyButton = document.getElementById("apply");
const allButton = document.getElementById("all");
const noneButton = document.getElementById("none");
const downloadButton = document.getElementById("download");
const errorBox = document.getElementById("error");
const searchInput = document.getElementById("search");
const emptyState = document.getElementById("empty-state");

let entries = [];
let originalData = null;
let removeIndexes = new Set();
let fileName = "lorebook";
let dataShape = "array";
let mapKeys = [];

function getEntryId(entry, index) {
    return String(entry?.id ?? index + 1);
}

function getEntryKeys(entry) {
    const keys = entry?.key ?? entry?.keys ?? entry?.keywords ?? entry?.keywordsRaw ?? entry?.keysRaw ?? [];
    return Array.isArray(keys) ? keys.join(", ") : String(keys ?? "");
}

function getDescription(entry) {
    return String(entry?.comment ?? entry?.name ?? entry?.title ?? entry?.description ?? "");
}

function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || "";
}

function updateSummary() {
    const keptCount = entries.length - removeIndexes.size;
    summary.textContent = entries.length
        ? `${entries.length} entries loaded · ${removeIndexes.size} marked for removal · ${keptCount} kept`
        : "Choose a JSON file to get started.";
    downloadButton.disabled = entries.length === 0;
    allButton.disabled = entries.length === 0;
    noneButton.disabled = entries.length === 0;
    applyButton.disabled = entries.length === 0;
    idsInput.disabled = entries.length === 0;
    searchInput.disabled = entries.length === 0;
}

function renderEntries() {
    tableBody.replaceChildren();
    const query = searchInput.value.trim().toLocaleLowerCase();

    entries.forEach((entry, index) => {
        const id = getEntryId(entry, index);
        const keys = getEntryKeys(entry);
        const description = getDescription(entry);
        const searchable = `${id} ${keys} ${description} ${entry?.content ?? ""}`.toLocaleLowerCase();
        if (query && !searchable.includes(query)) return;

        const row = tableBody.insertRow();
        const checkboxCell = row.insertCell();
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", `Mark entry ${id} for removal`);
        checkbox.checked = removeIndexes.has(index);
        row.className = checkbox.checked ? "marked" : "";

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) removeIndexes.add(index);
            else removeIndexes.delete(index);
            row.className = checkbox.checked ? "marked" : "";
            updateSummary();
        });

        checkboxCell.append(checkbox);
        row.insertCell().textContent = id;
        row.insertCell().textContent = keys;
        row.insertCell().textContent = description;
    });

    emptyState.hidden = entries.length === 0 || tableBody.rows.length !== 0;
    updateSummary();
}

function isEntryLike(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) &&
        ("content" in value || "key" in value || "keys" in value || "keysRaw" in value || "keywords" in value || "id" in value);
}

function extractEntries(data) {
    if (Array.isArray(data)) {
        return { entries: data, shape: "array", mapKeys: [] };
    }

    if (!data || typeof data !== "object") {
        throw new Error("This JSON must contain a list of script entries or an object containing them.");
    }

    // Common export wrappers. Keep the original wrapper so it can be preserved on export.
    for (const key of ["entries", "scripts", "lorebook", "data", "items", "cards"]) {
        const value = data[key];
        if (Array.isArray(value)) return { entries: value, shape: `property:${key}`, mapKeys: [] };
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const values = Object.values(value);
            if (values.length && values.every(isEntryLike)) {
                return { entries: values, shape: `map-property:${key}`, mapKeys: Object.keys(value) };
            }
        }
    }

    // Some editors export an object keyed by entry ID instead of an array.
    const values = Object.values(data);
    if (values.length && values.every(isEntryLike)) {
        return { entries: values, shape: "map", mapKeys: Object.keys(data) };
    }

    throw new Error(`JSON parsed successfully, but no entries list was found. Top-level keys: ${Object.keys(data).slice(0, 12).join(", ") || "none"}. Expected an array, an entries/scripts/data/items array, or an object keyed by entry.`);
}

async function readJsonFile(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let encoding = "utf-8";
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
    else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
    else if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = "utf-8";

    let text = new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "").trim();
    // Some files have no BOM but are UTF-16LE and contain NUL bytes between characters.
    if (text.includes("\u0000") && bytes.length % 2 === 0) {
        const decoded = new TextDecoder("utf-16le").decode(buffer).replace(/^\uFEFF/, "").trim();
        if (decoded.startsWith("{") || decoded.startsWith("[")) text = decoded;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        const match = String(error.message).match(/position\s+(\d+)/i);
        let detail = error.message;
        if (match) {
            const pos = Number(match[1]);
            const before = text.slice(0, pos);
            const line = before.split("\n").length;
            const column = pos - before.lastIndexOf("\n");
            detail += ` (line ${line}, column ${column})`;
        }
        throw new Error(`The file isn't valid JSON: ${detail}. If this is an editor export, make sure you selected the actual .json file, not a ZIP or script text file.`);
    }
}

function parseIdList(text) {
    const ids = new Set();
    text.split(/[\s,]+/).filter(Boolean).forEach(part => {
        const range = part.match(/^(\d+)-(\d+)$/);
        if (!range) { ids.add(part); return; }
        const first = Number(range[1]);
        const last = Number(range[2]);
        const start = Math.min(first, last);
        const end = Math.max(first, last);
        if (end - start > 100000) return;
        for (let id = start; id <= end; id++) ids.add(String(id));
    });
    return ids;
}

function markEntriesById() {
    const ids = parseIdList(idsInput.value);
    entries.forEach((entry, index) => {
        if (ids.has(getEntryId(entry, index))) removeIndexes.add(index);
    });
    idsInput.value = "";
    renderEntries();
}

function selectAllEntries() {
    removeIndexes = new Set(entries.map((_, index) => index));
    renderEntries();
}

function clearSelection() {
    removeIndexes.clear();
    renderEntries();
}

function buildFilteredData() {
    const kept = entries.filter((_, index) => !removeIndexes.has(index));
    if (dataShape === "array") return kept;

    const result = structuredClone(originalData);
    if (dataShape.startsWith("property:")) {
        result[dataShape.slice("property:".length)] = kept;
    } else if (dataShape.startsWith("map-property:")) {
        const property = dataShape.slice("map-property:".length);
        const originalMap = result[property];
        const newMap = {};
        entries.forEach((entry, index) => {
            if (!removeIndexes.has(index)) newMap[mapKeys[index]] = entry;
        });
        result[property] = newMap;
    } else if (dataShape === "map") {
        const newMap = {};
        entries.forEach((entry, index) => {
            if (!removeIndexes.has(index)) newMap[mapKeys[index]] = entry;
        });
        return newMap;
    }
    return result;
}

function downloadFilteredFile() {
    try {
        const result = buildFilteredData();
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName}_filtered.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showError("");
    } catch (error) {
        showError(`Couldn't create the filtered file: ${error.message}`);
    }
}

async function loadLorebook() {
    const file = fileInput.files[0];
    if (!file) return;
    showError("");

    try {
        const data = await readJsonFile(file);
        const extracted = extractEntries(data);
        if (!extracted.entries.length) throw new Error("The JSON structure was recognized, but it contains no entries.");
        const invalidIndex = extracted.entries.findIndex(entry => !entry || typeof entry !== "object" || Array.isArray(entry));
        if (invalidIndex !== -1) throw new Error(`Entry ${invalidIndex + 1} isn't an object. The file may use a different format.`);

        entries = extracted.entries;
        originalData = data;
        dataShape = extracted.shape;
        mapKeys = extracted.mapKeys;
        fileName = file.name.replace(/\.[^.]+$/, "") || "lorebook";
        removeIndexes.clear();
        table.hidden = false;
        renderEntries();
        showError("");
    } catch (error) {
        entries = [];
        originalData = null;
        removeIndexes.clear();
        table.hidden = true;
        updateSummary();
        showError(error.message || String(error));
    }
}

fileInput.addEventListener("change", loadLorebook);
applyButton.addEventListener("click", markEntriesById);
allButton.addEventListener("click", selectAllEntries);
noneButton.addEventListener("click", clearSelection);
downloadButton.addEventListener("click", downloadFilteredFile);
searchInput.addEventListener("input", renderEntries);
idsInput.addEventListener("keydown", event => { if (event.key === "Enter") markEntriesById(); });
