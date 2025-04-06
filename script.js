const sizeMap = { "1x1": "1", "1x2": "2", "2x1": "3", "1x3": "4", "3x1": "5", "2x2": "6" };
const reverseSizeMap = Object.fromEntries(Object.entries(sizeMap).map(([k, v]) => [v, k]));


const eventListenersStore = {};

function setupSearchableSelect(inputId, optionsId, options = []) {
    const input = document.getElementById(inputId);
    const optionsContainer = document.getElementById(optionsId);

    if (eventListenersStore[inputId]) {
        input.removeEventListener('focus', eventListenersStore[inputId].focus);
        input.removeEventListener('blur', eventListenersStore[inputId].blur);
        input.removeEventListener('input', eventListenersStore[inputId].input);
    }

    const updateOptions = (searchText = '') => {
        if (!optionsContainer) {
            return;
        }

        optionsContainer.innerHTML = '';
        const filteredOptions = options.filter(option =>
            option.toLowerCase().includes(searchText.toLowerCase())
        );

        filteredOptions.forEach(option => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = option;
            div.onclick = () => {
                input.value = option;
                optionsContainer.style.display = 'none';
            };
            optionsContainer.appendChild(div);
        });
    };

    const handleFocus = () => {
        if (!optionsContainer) return;
        updateOptions(input.value);
        optionsContainer.style.display = 'block';
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (!optionsContainer) return;
            optionsContainer.style.display = 'none';
        }, 200);
    };

    const handleInput = () => {
        if (!optionsContainer) return;
        updateOptions(input.value);
        optionsContainer.style.display = 'block';
    };

    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('input', handleInput);

    eventListenersStore[inputId] = {
        focus: handleFocus,
        blur: handleBlur,
        input: handleInput
    };

    updateOptions();
}

function updateModifierDropdowns() {
    const size = document.getElementById('idol-size').value;


    const modifiersForSize = window.allModifiersData[size];


    if (modifiersForSize) {
        setupSearchableSelect('prefix1', 'prefix1-options', modifiersForSize.prefixes);
        setupSearchableSelect('prefix2', 'prefix2-options', modifiersForSize.prefixes);
        setupSearchableSelect('suffix1', 'suffix1-options', modifiersForSize.suffixes);
        setupSearchableSelect('suffix2', 'suffix2-options', modifiersForSize.suffixes);
    } else {
        console.error(`No modifier data found for size: ${size}`);
        setupSearchableSelect('prefix1', 'prefix1-options', []);
        setupSearchableSelect('prefix2', 'prefix2-options', []);
        setupSearchableSelect('suffix1', 'suffix1-options', []);
        setupSearchableSelect('suffix2', 'suffix2-options', []);
    }
}

document.addEventListener('DOMContentLoaded', () => {


    const sizeSelect = document.getElementById('idol-size');
    sizeSelect.addEventListener('change', updateModifierDropdowns);

    createGrid();
    updateModifierDropdowns();
    loadGridState();

    const deleteArea = document.getElementById('delete-area');
    if (deleteArea) {
        deleteArea.addEventListener('dragenter', handleDragEnterDelete);
        deleteArea.addEventListener('dragleave', handleDragLeaveDelete);
    }
    document.body.addEventListener('dragend', handleDragEnd);
});
const blockedCells = [
    [0, 0], [2, 1], [3, 1], [4, 1], [3, 2],
    [3, 3], [3, 4], [2, 4], [4, 4], [6, 5]
];

function createGrid() {
    const grid = document.getElementById("grid");
    grid.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 6; j++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = i;
            cell.dataset.col = j;
            if (blockedCells.some(([x, y]) => x === i && y === j)) {
                cell.classList.add("blocked");
            }
            grid.appendChild(cell);
        }
    }
    grid.addEventListener('dragover', allowDrop);
    grid.addEventListener('drop', drop);
}

function extractModifierData(mod) {
    const openParenIndex = mod.indexOf('(');
    const closeParenIndex = mod.indexOf(')');

    if (openParenIndex === -1 || closeParenIndex === -1) {
        return { type: 'unknown' };
    }

    const textBeforeNumber = mod.substring(0, openParenIndex).trim();
    let textAfterNumber = mod.substring(closeParenIndex + 1).trim();
    textAfterNumber = textAfterNumber.replace("%", "").trim()

    let numericPart = mod.substring(openParenIndex + 1, closeParenIndex).trim();

    if (numericPart.includes('–')) {
        const [minStr, maxStr] = numericPart.split('–').map(s => s.replace('%', '').trim());
        const minPercentage = parseFloat(minStr);
        const maxPercentage = parseFloat(maxStr);

        if (isNaN(minPercentage) || isNaN(maxPercentage)) {
            return { type: 'unknown' }
        }

        return {
            type: 'percentageRange',
            minPercentage,
            maxPercentage,
            textBeforeNumber,
            textAfterNumber
        };
    } else if (numericPart.includes('%')) {
        const percentage = parseFloat(numericPart.replace('%', ''));
        if (isNaN(percentage)) {
            return { type: 'unknown' }
        }
        return {
            type: 'percentage',
            percentage,
            textBeforeNumber,
            textAfterNumber
        };
    } else if (numericPart.startsWith('x')) {
        const count = parseInt(numericPart.substring(1), 10);
        if (isNaN(count)) {
            return { type: 'unknown' }
        }
        return {
            type: 'count',
            count,
            textBeforeNumber,
            textAfterNumber
        };
    } else {
        return { type: 'unknown' };
    }
}

function areModifiersSameBase(mod1, mod2) {
    const data1 = extractModifierData(mod1);
    const data2 = extractModifierData(mod2);

    return data1.type === data2.type && data1.type !== 'unknown' && data1.textBeforeNumber === data2.textBeforeNumber && data1.textAfterNumber === data2.textAfterNumber;
}

function formatModifier(data) {
    if (data.type === 'percentageRange') {
        return `${data.textBeforeNumber}(${data.minPercentage}–${data.maxPercentage})% ${data.textAfterNumber}`;
    } else if (data.type === 'percentage') {
        return `${data.textBeforeNumber}(${data.percentage})% ${data.textAfterNumber}`;
    } else if (data.type === 'count') {
        return `${data.textBeforeNumber}(x${data.count}) ${data.textAfterNumber}`;
    } else {
        return "";
    }
}

function sumModifiers(mod1, mod2) {
    const data1 = extractModifierData(mod1);
    const data2 = extractModifierData(mod2);

    if (!areModifiersSameBase(mod1, mod2)) {
        return mod1;
    }

    if (data1.type === 'percentageRange' && data2.type === 'percentageRange') {
        return formatModifier({
            type: 'percentageRange',
            minPercentage: data1.minPercentage + data2.minPercentage,
            maxPercentage: data1.maxPercentage + data2.maxPercentage,
            textBeforeNumber: data1.textBeforeNumber,
            textAfterNumber: data1.textAfterNumber
        });
    } else if (data1.type === 'percentage' && data2.type === 'percentage') {
        return formatModifier({
            type: 'percentage',
            percentage: data1.percentage + data2.percentage,
            textBeforeNumber: data1.textBeforeNumber,
            textAfterNumber: data1.textAfterNumber
        });
    } else if (data1.type === 'count' && data2.type === 'count') {
        return formatModifier({
            type: 'count',
            count: data1.count + data2.count,
            textBeforeNumber: data1.textBeforeNumber,
            textAfterNumber: data1.textAfterNumber
        });
    } else {
        return mod1;
    }
}

function updateTotalBonuses() {
    const idols = document.querySelectorAll('#grid .idol');
    let allModifiers = [];

    idols.forEach(idol => {
        const modsText = idol.dataset.mods;
        if (modsText) {
            allModifiers.push(...modsText.split('\n').filter(mod => mod.trim() !== ''));
        }
    });

    let combinedModifiers = {};

    for (let i = 0; i < allModifiers.length; i++) {
        let currentMod = allModifiers[i];
        let data = extractModifierData(currentMod);

        let canCombine = data.type !== 'count' && data.type !== 'unknown';

        let combined = false;
        for (let modKey in combinedModifiers) {
            if (canCombine && areModifiersSameBase(currentMod, modKey)) {
                combinedModifiers[modKey].mod = sumModifiers(combinedModifiers[modKey].mod, currentMod);
                combinedModifiers[modKey].count++;
                combined = true;
                break;
            } else if (!canCombine && currentMod == modKey) {
                combinedModifiers[modKey].count++;
                combined = true;
                break;
            }
        }

        if (!combined) {
            combinedModifiers[currentMod] = { mod: currentMod, count: 1 };
        }
    }


    const bonusesDiv = document.getElementById('bonuses');
    bonusesDiv.innerHTML = '';

    for (let modKey in combinedModifiers) {
        const p = document.createElement('p');
        if (combinedModifiers[modKey].count > 1 && extractModifierData(combinedModifiers[modKey].mod).type != 'percentage' && extractModifierData(combinedModifiers[modKey].mod).type != 'percentageRange') {
            p.textContent = `${modKey} x${combinedModifiers[modKey].count}`;
        } else {
            p.textContent = combinedModifiers[modKey].mod;
        }
        bonusesDiv.appendChild(p);
    }
}

let idolCreationIndex = 0;
function createIdol() {
    const size = document.getElementById("idol-size").value;
    const prefix1 = document.getElementById("prefix1").value;
    const prefix2 = document.getElementById("prefix2").value;
    const suffix1 = document.getElementById("suffix1").value;
    const suffix2 = document.getElementById("suffix2").value;

    const idol = document.createElement("div");
    idol.classList.add("idol");
    idol.draggable = true;
    idol.dataset.size = size;
    idol.id = `idol-${Date.now()}`;

    const mods = [prefix1, prefix2, suffix1, suffix2]
        .filter(mod => mod)
        .join('\n');
    idol.dataset.mods = mods;

    idol.textContent = size;

    const [width, height] = size.split("x").map(Number);
    idol.style.width = `${width * 52}px`;
    idol.style.height = `${height * 52}px`;

    idol.addEventListener('dragstart', drag);
    idol.addEventListener('dblclick', removeIdol);
    idol.addEventListener('mouseover', showMods);
    idol.addEventListener('mouseout', hideMods);

    const gridContainer = document.getElementById("grid");
    const gridRect = gridContainer.getBoundingClientRect();
    const idols = document.querySelectorAll('#grid .idol')

    let initialCol = 6;
    let initialRow = 0;

    for (let r = 0; r < 7; r++) {
        let positionOccupied = false;
        for (let c = 0; c < idols.length; c++) {
            const rect = idols[c].getBoundingClientRect();
            const idolRow = Math.floor((rect.top - gridRect.top) / 52);
            const idolCol = Math.floor((rect.left - gridRect.left) / 52);

            if (idolRow === r && idolCol >= 6) {
                positionOccupied = true;
                break;
            }
        }
        if (!positionOccupied) {
            initialRow = r;
            break;
        }
    }

    idol.style.position = 'absolute';
    idol.style.left = `${initialCol * 52 + gridRect.left}px`;
    idol.style.top = `${initialRow * 52 + gridRect.top}px`;
    document.body.appendChild(idol);

    updateGridStateDebounced();
    updateTotalBonuses();
}

function allowDrop(event) {
    event.preventDefault();
}

let currentDragInfo = null;

function drag(event) {
    const idol = event.target;
    idol.classList.add('dragging');
    event.dataTransfer.setData('text/plain', event.target.id);
    hideMods();

    const overlay = document.createElement('div');
    overlay.id = 'drag-overlay';
    overlay.className = 'drop-overlay';
    const size = idol.dataset.size.split('x').map(Number);
    overlay.style.width = `${size[0] * 52}px`;
    overlay.style.height = `${size[1] * 52}px`;
    document.getElementById('grid').appendChild(overlay);

    currentDragInfo = {
        width: size[0],
        height: size[1],
        idolId: idol.id
    };
}

function handleDragOver(event) {
    event.preventDefault();
    if (!currentDragInfo) return;

    const grid = document.getElementById('grid');
    const rect = grid.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let col = Math.floor(mouseX / 52);
    let row = Math.floor(mouseY / 52);

    col = Math.max(0, Math.min(col, 6 - currentDragInfo.width));
    row = Math.max(0, Math.min(row, 7 - currentDragInfo.height));

    const isValid = isValidPosition(row, col, currentDragInfo.width, currentDragInfo.height, currentDragInfo.idolId);

    const overlay = document.getElementById('drag-overlay');
    if (overlay) {
        overlay.style.left = `${col * 52}px`;
        overlay.style.top = `${row * 52}px`;
        overlay.style.backgroundColor = isValid ? 'rgba(77, 182, 172, 0.4)' : 'rgba(229, 115, 115, 0.4)';
    }
}

function drop(event) {
    event.preventDefault();
    const idol = document.getElementById(currentDragInfo.idolId);
    if (!idol) return;

    const overlay = document.getElementById('drag-overlay');
    if (overlay) {
        const col = parseInt(overlay.style.left) / 52;
        const row = parseInt(overlay.style.top) / 52;

        if (isValidPosition(row, col, currentDragInfo.width, currentDragInfo.height, idol.id)) {
            idol.style.left = `${col * 52}px`;
            idol.style.top = `${row * 52}px`;
            document.getElementById('grid').appendChild(idol);
            updateGridStateDebounced();
            updateTotalBonuses();
        }
        overlay.remove();
    }
    
    currentDragInfo = null;
    idol.classList.remove('dragging');
}

function handleDragEnd(event) {
    const overlay = document.getElementById('drag-overlay');
    if (overlay) overlay.remove();

    const deleteArea = document.getElementById('delete-area');
    if (deleteArea) {
        deleteArea.classList.remove('drag-over');
    }

    currentDragInfo = null;
    if (event.target && event.target.classList) {
         event.target.classList.remove('dragging');
    }
}

function handleDragEnterDelete(event) {
    event.preventDefault();
    event.target.classList.add('drag-over');
}

function handleDragLeaveDelete(event) {
    event.target.classList.remove('drag-over');
}

function dropOnDeleteArea(event) {
    event.preventDefault();
    const idolId = event.dataTransfer.getData('text/plain');
    const idol = document.getElementById(idolId);

    if (idol) {
        hideMods();
        idol.remove();
        updateGridStateDebounced();
        updateTotalBonuses();
    }

    event.target.classList.remove('drag-over');
}

function isValidPosition(row, col, width, height, selfId = null) {
    if (row < 0 || col < 0 || row + height > 7 || col + width > 6) return false;

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (blockedCells.some(([x, y]) => x === row + i && y === col + j)) {
                return false;
            }
            const existingIdols = document.querySelectorAll('#grid .idol');
            for (const existingIdol of existingIdols) {
                if (selfId && existingIdol.id === selfId) continue;

                const existingRect = existingIdol.getBoundingClientRect();
                const existingRow = Math.floor((existingRect.top - grid.getBoundingClientRect().top) / 52);
                const existingCol = Math.floor((existingRect.left - grid.getBoundingClientRect().left) / 52);
                const [existingWidth, existingHeight] = existingIdol.dataset.size.split('x').map(Number);

                if (row + i >= existingRow && row + i < existingRow + existingHeight &&
                    col + j >= existingCol && col + j < existingCol + existingWidth) {
                    return false;
                }
            }
        }
    }
    return true;
}

function removeIdol(event) {
    hideMods();
    event.target.remove();
    updateGridStateDebounced();
    updateTotalBonuses();
}

function showMods(event) {
    const idol = event.target;
    if (idol.classList.contains('dragging')) {
        return;
    }
    const mods = idol.dataset.mods;
    if (!mods) return;

    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.classList.add('tooltip');
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = mods.replace(/\n/g, '<br>');
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
}


function hideMods() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

let debounceTimer;

function updateGridStateDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateGridState, 250);
}

function serializeGridState() {
    const idols = document.querySelectorAll('#grid .idol');
    const idolData = [];

    idols.forEach(idol => {
        const rect = idol.getBoundingClientRect();
        const gridRect = document.getElementById('grid').getBoundingClientRect();
        const row = Math.floor((rect.top - gridRect.top) / 52);
        const col = Math.floor((rect.left - gridRect.left) / 52);
        const sizeId = sizeMap[idol.dataset.size];

        const modStrings = idol.dataset.mods.split('\n').map(s => s.trim());
        const modIds = [];

        function findModifierId(modString) {
            return window.modifierIdMap.prefixes[modString] || window.modifierIdMap.suffixes[modString] || "0";
        }

        modIds.push(findModifierId(modStrings[0] || ""));
        modIds.push(findModifierId(modStrings[1] || ""));
        modIds.push(findModifierId(modStrings[2] || ""));
        modIds.push(findModifierId(modStrings[3] || ""));

        idolData.push(`${row}${col}/${sizeId}/${modIds.join('/')}`);

    });

    return idolData.join(';');
}

function deserializeGridState(stateString) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 6; j++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = i;
            cell.dataset.col = j;
            if (blockedCells.some(([x, y]) => x === i && y === j)) {
                cell.classList.add("blocked");
            }
            grid.appendChild(cell);
        }
    }
    if (!stateString) return;

    const idolData = stateString.split(';').map(idolStr => {
        const [rowCol, sizeId, modId1, modId2, modId3, modId4] = idolStr.split('/');
        const row = parseInt(rowCol.substring(0, 1));
        const col = parseInt(rowCol.substring(1));
        const size = reverseSizeMap[sizeId];

        const modIds = [modId1, modId2, modId3, modId4];
        const mods = modIds.map(modId => {
            if (modId === "0") return '';

            let foundMod = '';
            for (const type in window.modifierIdMap) {
                if (window.modifierIdMap[type]) {
                    for (const mod in window.modifierIdMap[type]) {
                        if (window.modifierIdMap[type][mod] === modId) {
                            foundMod = mod;
                            break;
                        }
                    }
                }
                if (foundMod) break;
            }
            return foundMod;
        }).filter(mod => mod).join('\n');

        return { row, col, size, mods };
    });

    idolData.forEach(idolData => {
        const { row, col, size, mods } = idolData;
        const idol = document.createElement('div');
        idol.classList.add("idol");
        idol.draggable = true;
        idol.dataset.size = size;
        idol.dataset.mods = mods;
        idol.id = `idol-${Date.now()}`;

        idol.textContent = size;

        const [width, height] = size.split('x').map(Number);
        idol.style.width = `${width * 52}px`;
        idol.style.height = `${height * 52}px`;

        idol.addEventListener('dragstart', drag);
        idol.addEventListener('dblclick', removeIdol);
        idol.addEventListener('mouseover', showMods);
        idol.addEventListener('mouseout', hideMods);

        const grid = document.getElementById('grid');
        if (isValidPosition(row, col, width, height)) {
            grid.appendChild(idol);
            idol.style.left = `${col * 52}px`;
            idol.style.top = `${row * 52}px`;
        }
    });
}

function updateGridState() {
    const serializedState = serializeGridState();
    const encodedState = encodeURIComponent(serializedState);
    window.history.replaceState(null, "", `#${encodedState}`);
    updateTotalBonuses();
}

function loadGridState() {
    const encodedState = window.location.hash.substring(1);
    if (encodedState) {
        try {
            const serializedState = decodeURIComponent(encodedState);
            deserializeGridState(serializedState);
            updateTotalBonuses();
        } catch (e) {
            console.error("Error decoding or deserializing grid state:", e);
            window.location.hash = '';
        }
    }
}
