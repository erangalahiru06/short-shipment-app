// Change history: see CHANGELOG.md. Add future behavior changes under a versioned section.

// ============================================================
// DOM REFERENCES AND UI STATE
// ============================================================
const tbody = document.querySelector('#inputTable tbody');
const containerTbody = document.querySelector('#containerTable tbody');

function containersEnabled() {
    return !!document.querySelector('#enableContainers')?.checked;
}

function updateContainerUi() {
    let enabled = containersEnabled();
    let singleContainer = containerTbody.querySelectorAll('tr').length === 1;
    document.querySelectorAll('#containerTable input').forEach(i => {
        i.autocomplete = 'off';
        i.disabled = !enabled;
        let isAutoTotal = singleContainer && i.dataset.ck && !['nos', 'container'].includes(i.dataset.ck);
        i.readOnly = enabled && isAutoTotal;
        i.classList.toggle('auto-container-total', enabled && isAutoTotal);
    });
    let addBtn = document.querySelector('#addContainerRow');
    let remBtn = document.querySelector('#removeContainerRow');
    if (addBtn) addBtn.disabled = !enabled;
    if (remBtn) remBtn.disabled = !enabled;
}

function updateCertPagePrintOption() {
    let checked = document.querySelector('#printCertPage')?.checked !== false;
    document.body.classList.toggle('no-cert-page', !checked);
}

function money(n) {
    return (Number(n) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

function dvalFormat(n) {
    return Math.round(Number(n) || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0
    })
}

function num(n) {
    return (Number(n) || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0
    })
}

function formatPrintTimestamp() {
    let d = new Date();
    let date = d.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
    });
    let time = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    return `${date}, ${time}`
}

function updatePrintTimestamp() {
    let el = document.querySelector('#printTimestamp');
    if (el) el.textContent = formatPrintTimestamp()
}

function updateSignatureByRep() {
    let rep = (document.querySelector('#repName')?.value || '').trim().toLowerCase();
    let sig = document.querySelector('.cert-sig');
    if (sig) {
        let remote = [];
        try {
            remote = JSON.parse(localStorage.getItem(REMOTE_EXPORTER_CACHE_KEY) || '[]');
        } catch (error) {}
        let remoteRecord = remote.find(item => String(item.name || '').trim().toLowerCase() === rep);
        let isManolika = rep === 'manolika premachandra';
        sig.src = remoteRecord?.signature_png || (isManolika ? 'Manolika%20Premachandra.png' : 'Nuwan%20Bandara.png');
        sig.classList.toggle('manolika-signature', isManolika);
        sig.classList.toggle('nuwan-signature', !isManolika);
    }
}

function updateDesignationByRep() {
    let rep = (document.querySelector('#repName')?.value || '').trim().toLowerCase();
    let map = {
        'nuwan bandara': 'Assistant Manager - Commercial & Logistic',
        'manolika premachandra': 'Senior Executive - Commercial & Logistic'
    };
    let des = document.querySelector('#designation');
    let enterprise = document.querySelector('#enterprise');
    let remote = [];
    try {
        remote = JSON.parse(localStorage.getItem(REMOTE_EXPORTER_CACHE_KEY) || '[]');
    } catch (error) {}
    let remoteRecord = remote.find(item => String(item.name || '').trim().toLowerCase() === rep);
    if (des) {
        des.readOnly = true;
        des.value = map[rep] || remoteRecord?.designation || des.value;
    }
    if (enterprise && remoteRecord?.enterprise) enterprise.value = remoteRecord.enterprise;
    updateSignatureByRep();
}

function autoRepByRemittanceType() {
    let type = document.querySelector('#formType')?.value;
    let rep = document.querySelector('#repName');
    if (rep) {
        rep.value = type === 'enter-dval' ? 'Manolika Premachandra' : 'Nuwan Bandara';
    }
    updateDesignationByRep();
}

function isEnterDvalMode() {
    return document.querySelector('#formType')?.value === 'enter-dval'
}

function isNoShipInvoiceMode() {
    return document.querySelector('#formType')?.value === 'no-ship-invoice'
}

function rowPrintFobValue(r) {
    return isNoShipInvoiceMode() ? (r.cusPcs ? ((r.fob / r.cusPcs) * r.shipPcs) : 0) : r.fob
}

function seedDValueSample() {
    if (!isEnterDvalMode()) return;
    let i = mergedEntryInput('dval') || document.querySelector('[data-k="dval"]');
    if (i && String(i.value || '').trim() === '') i.value = '2435';
}

function toggleDvalMode() {
    let yes = isEnterDvalMode();
    let noShip = isNoShipInvoiceMode();
    document.body.classList.toggle('enter-dval-mode', yes);
    document.body.classList.toggle('no-ship-invoice-mode', noShip);
    let q = document.querySelector('#qtyHead');
    if (q) q.colSpan = yes ? 6 : 5;
    let d = document.querySelector('#deductionLabel');
    if (d) {
        let type = document.querySelector('#formType')?.value;
        d.style.display = (type === 'enter-dval' || type === 'non-remittance') ? 'none' : '';
    }
    let h = document.querySelector('#fobHeader');
    if (h) h.innerHTML = noShip ? 'FOB VALUE OF THECUSDEC' : 'VALUE OF THE SHIPINVOICE';
}

// ============================================================
// NUMERIC INPUTS AND FORMULA HANDLING
// ============================================================
function entryRows() {
    return [...tbody.querySelectorAll('tr')];
}

function mergedEntryInput(k) {
    let first = entryRows()[0];
    return first ? first.querySelector(`[data-k="${k}"]`) : null;
}

function mergedEntryRaw(k) {
    let input = mergedEntryInput(k);
    return input ? String(input.value ?? '') : '';
}

function parseNumericInput(value) {
    value = String(value || '').trim();

    if (value === '') return 0;

    if (value.startsWith('=')) {
        let expr = value.substring(1).trim();

        if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
            return 0;
        }

        try {
            let result = Function('"use strict"; return (' + expr + ')')();

            if (!isFinite(result)) return 0;

            return Number(result);
        } catch (e) {
            return 0;
        }
    }

    return Number(value) || 0;
}

function evaluateInputFormula(input) {
    if (!input) return;

    let value = String(input.value || '').trim();

    if (!value.startsWith('=')) return;

    let result = parseNumericInput(value);

    if (isFinite(result)) {
        input.dataset.formula = value;
        input.dataset.result = result;

        input.value = result;

        calc();
    }
}

function mergedEntryNumber(k) {
    return parseNumericInput(mergedEntryRaw(k));
}

function applyMergedEntryCells() {
    let trs = entryRows();
    let rowSpan = Math.max(trs.length, 1);
    let groups = [{
        cls: 'merge-gross-cell',
        active: true
    }, {
        cls: 'merge-net-cell',
        active: true
    }, {
        cls: 'merge-dval-cell',
        active: isEnterDvalMode()
    }, {
        cls: 'merge-fob-cell',
        active: false
    }];
    groups.forEach(g => {
        trs.forEach((tr, idx) => {
            let cell = tr.querySelector('.' + g.cls);
            if (!cell) return;
            if (idx === 0) {
                cell.rowSpan = g.active ? rowSpan : 1;
                cell.style.display = '';
                cell.classList.toggle('merged-entry-total', g.active);
            } else {
                cell.rowSpan = 1;
                cell.style.display = g.active ? 'none' : '';
                cell.classList.remove('merged-entry-total');
            }
        });
    });
}

function distributedGrossForRow(r, totalShipPcs, totalGross) {
    return totalShipPcs ? ((totalGross / totalShipPcs) * (r.shipPcs || 0)) : 0;
}

function distributedNetForRow(r, totalShipPcs, totalNet) {
    return totalShipPcs ? ((totalNet / totalShipPcs) * (r.shipPcs || 0)) : 0;
}

function syncCusdecRows() {
    let cusdecInputs = [...tbody.querySelectorAll('[data-k="cusdec"]')];
    if (!cusdecInputs.length) return;
    let firstValue = cusdecInputs[0].value;
    cusdecInputs.forEach((inp, idx) => {
        if (idx === 0) {
            inp.readOnly = false;
            inp.classList.remove('readonly-cusdec');
        } else {
            inp.value = firstValue;
            inp.readOnly = true;
            inp.classList.add('readonly-cusdec');
        }
    });
}

function focusTableCellInput(table, currentInput, rowDelta, colDelta, linearDelta) {
    let cell = currentInput.closest('td');
    let row = currentInput.closest('tr');
    if (!cell || !row || !table) return;
    if (linearDelta) {
        let inputs = [...table.querySelectorAll('tbody input')];
        let idx = inputs.indexOf(currentInput);
        let next = idx + linearDelta;
        while (next >= 0 && next < inputs.length) {
            let target = inputs[next];
            if (target && !target.disabled && !target.readOnly && target.offsetParent !== null) {
                target.focus();
                target.select?.();
                return;
            }
            next += linearDelta;
        }
        return;
    }
    let rows = [...table.querySelectorAll('tbody tr')];
    let rowIndex = rows.indexOf(row);
    let targetRow = rows[rowIndex + rowDelta];
    if (!targetRow) return;
    let targetCell = targetRow.children[cell.cellIndex + colDelta];
    let targetInput = targetCell?.querySelector('input');
    if (targetInput && !targetInput.disabled && !targetInput.readOnly && targetInput.offsetParent !== null) {
        targetInput.focus();
        targetInput.select?.();
    }
}

function handleArrowNavigation(e) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    let input = e.target;
    if (!(input instanceof HTMLInputElement)) return;

    let table = input.closest('table');
    if (!table || !['inputTable', 'containerTable'].includes(table.id)) return;

    evaluateInputFormula(input);
    e.preventDefault();


    if (e.key === 'ArrowRight') focusTableCellInput(table, input, 0, 0, 1);
    if (e.key === 'ArrowLeft') focusTableCellInput(table, input, 0, 0, -1);
    if (e.key === 'ArrowDown') focusTableCellInput(table, input, 1, 0, 0);
    if (e.key === 'ArrowUp') focusTableCellInput(table, input, -1, 0, 0);
}
document.addEventListener('keydown', handleArrowNavigation);

document.addEventListener('focusin', function(e) {

    let input = e.target;

    if (!(input instanceof HTMLInputElement)) return;

    if (input.dataset.formula) {
        input.value = input.dataset.formula;
    }
});

document.addEventListener('focusout', function(e) {

    let input = e.target;

    if (!(input instanceof HTMLInputElement)) return;

    let value = String(input.value || '').trim();

    if (value.startsWith('=')) {
        evaluateInputFormula(input);
        return;
    }

    if (input.dataset.formula) {
        let result = parseNumericInput(input.dataset.formula);
        input.value = result;
    }
});

// ============================================================
// DATA ROWS AND CONTAINER ROWS
// ============================================================
function today() {
    document.querySelector('#docDate').valueAsDate = new Date();
}

function restrictDataEntryInput(input) {
    let digitsOnly = ['cusdec', 'hs'].includes(input.dataset.k);
    input.inputMode = digitsOnly ? 'numeric' : 'decimal';

    let sanitize = () => {
        let value = input.value.replace(digitsOnly ? /\D/g : /[^\d.+\-*/()=]/g, '');
        if (!digitsOnly) {
            let decimalIndex = value.indexOf('.');
            if (decimalIndex !== -1) {
                value = value.slice(0, decimalIndex + 1) + value.slice(decimalIndex + 1).replace(/\./g, '');
            }
        }
        if (input.value !== value) input.value = value;
    };

    input.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Enter' && input.value.trim().startsWith('=')) {
            evaluateInputFormula(input);
            e.preventDefault();
            return;
        }
        if (e.key.length !== 1) return;
        if (/\d/.test(e.key)) return;
        if (!digitsOnly && /^[=.+\-*/()]$/.test(e.key)) return;
        e.preventDefault();
    });

    input.addEventListener('input', () => {
        delete input.dataset.formula;
        delete input.dataset.result;
        if (!digitsOnly) {
            input.value = input.value.replace(/[^\d.+\-*/()=]/g, '');
            if (input.value.includes('=')) {
                input.value = '=' + input.value.replace(/=/g, '').replace(/^=/, '');
            }
        }
        sanitize();
    });

    sanitize();
}

function addRow(values = {}) {
    if (!values.cusdec) {
        let existing = [...tbody.querySelectorAll('[data-k="cusdec"]')]
            .map(x => x.value)
            .find(Boolean);

        if (existing) values.cusdec = existing;
    }

    let tr = document.createElement('tr');

    tr.innerHTML = `
        <td><input data-k="cusdec"></td>
        <td><input data-k="hs"></td>
        <td><input type="text" data-k="cusCtn" value="0"></td>
        <td><input type="text" data-k="cusPcs" value="0"></td>
        <td class="merge-fob-cell"><input type="text" step="0.01" data-k="fob" value="0"></td>
        <td class="dval-col merge-dval-cell"><input type="text" step="0.01" data-k="dval" value=""></td>
        <td><input type="text" data-k="shipCtn" value="0"></td>
        <td><input type="text" data-k="shipPcs" value="0"></td>
        <td class="merge-gross-cell"><input type="text" step="0.01" data-k="gross" value="0"></td>
        <td class="merge-net-cell"><input type="text" step="0.01" data-k="net" value="0"></td>
        <td class="auto" data-k="shortCtn">0</td>
        <td class="auto" data-k="shortPcs">0</td>
    `;

    tbody.appendChild(tr);

    Object.entries(values).forEach(([k, v]) => {
        let el = tr.querySelector(`[data-k="${k}"]`);
        if (el) el.value = v;
    });

        tr.querySelectorAll('input').forEach(i => {
            i.autocomplete = 'off';
            restrictDataEntryInput(i);
            i.addEventListener('input', calc);
        });

    syncCusdecRows();
    calc();
}

function rowObj(tr, idx) {
    let o = {
        item: idx + 1
    };

    tr.querySelectorAll('input').forEach(i => {

        let storedValue = i.dataset.formula || i.value;

        o[i.dataset.k] = storedValue;
        o[i.dataset.k + 'Raw'] = storedValue;
    });
    ['cusCtn', 'cusPcs', 'shipCtn', 'shipPcs', 'fob', 'dval', 'gross', 'net']
    .forEach(k => o[k] = parseNumericInput(o[k]));
    o.shortCtn = o.cusCtn - o.shipCtn;
    o.shortPcs = o.cusPcs - o.shipPcs;
    return o
}

function rows() {
    return [...tbody.querySelectorAll('tr')].map(rowObj).filter(r => r.cusdec || r.hs || r.cusCtn || r.cusPcs || r.shipCtn || r.shipPcs || r.fob || r.dval || r.gross || r.net)

}

function addContainerRow(values = {}) {

    let existingRows = [...containerTbody.querySelectorAll('tr')];

    // When adding row 2, clear only the auto-filled values from row 1.
    if (existingRows.length === 1) {

        let firstRow = existingRows[0];

        ['ctns', 'pcs', 'gw', 'nw'].forEach(k => {
            let el = firstRow.querySelector(`[data-ck="${k}"]`);

            if (el) {
                el.value = '';
            }
        });
    }

    let tr = document.createElement('tr');

    tr.innerHTML = `
    <td><input data-ck="nos" readonly></td>
    <td><input data-ck="container" placeholder="ERAN251825" maxlength="11"></td>
    <td><input type="number" step="1" data-ck="ctns" placeholder="2"></td>
    <td><input type="number" step="1" data-ck="pcs" placeholder="5"></td>
    <td><input type="number" step="0.01" data-ck="gw" placeholder="125.60"></td>
    <td><input type="number" step="0.01" data-ck="nw" placeholder="120.36"></td>
  `;

    containerTbody.appendChild(tr);

    Object.entries(values).forEach(([k, v]) => {
        let el = tr.querySelector(`[data-ck="${k}"]`);
        if (el) el.value = v;
    });

    tr.querySelectorAll('input').forEach(i => {
        i.autocomplete = 'off';
        i.addEventListener('input', calc);
    });

    renumberContainers();
    updateContainerUi();
    calc();
}

function renumberContainers() {
    [...containerTbody.querySelectorAll('tr')].forEach((tr, idx) => {
        let nos = tr.querySelector('[data-ck="nos"]');
        if (nos) nos.value = idx + 1;
    });
}

function containerRows() {
    return [...containerTbody.querySelectorAll('tr')].map((tr, idx) => {
        let o = {
            item: idx + 1
        };
        tr.querySelectorAll('input').forEach(i => o[i.dataset.ck] = i.value);
        o.ctns = Number(o.ctns) || 0;
        o.pcs = Number(o.pcs) || 0;
        o.gw = Number(o.gw) || 0;
        o.nw = Number(o.nw) || 0;
        return o;
    }).filter(r => r.nos || r.container || r.ctns || r.pcs || r.gw || r.nw);
}

function syncSingleContainerFromShipment(totals) {
    if (!containersEnabled()) return;
    let trs = [...containerTbody.querySelectorAll('tr')];
    if (trs.length !== 1) return;
    let tr = trs[0];
    let ctns = tr.querySelector('[data-ck="ctns"]');
    let pcs = tr.querySelector('[data-ck="pcs"]');
    let gw = tr.querySelector('[data-ck="gw"]');
    let nw = tr.querySelector('[data-ck="nw"]');
    if (ctns) ctns.value = totals.shipCtn || 0;
    if (pcs) pcs.value = totals.shipPcs || 0;
    if (gw) gw.value = totals.gross ? Number(totals.gross.toFixed(2)) : 0;
    if (nw) nw.value = totals.net ? Number(totals.net.toFixed(2)) : 0;
}

function printableContainerRows() {
    if (!containersEnabled()) return [];
    return containerRows().filter(r => String(r.nos || '').trim());
}

function formatContainerLine(r) {
    let parts = [];
    if (r.nos) parts.push(r.nos);
    if (r.container) parts.push(r.container);
    if (r.ctns) parts.push(`CTNS ${num(r.ctns)}`);
    if (r.pcs) parts.push(`PCS ${num(r.pcs)}`);
    if (r.gw) parts.push(`G.W ${money(r.gw)}`);
    if (r.nw) parts.push(`N.W ${money(r.nw)}`);
    return parts.join(' / ');
}

// ============================================================
// VALIDATION AND CALCULATIONS
// ============================================================
function validateRows(data) {
    let errors = [];
    let totalGross = mergedEntryNumber('gross');
    let totalNet = mergedEntryNumber('net');
    let totalDval = mergedEntryNumber('dval');
    let totalFob = data.reduce((a, r) => a + (r.fob || 0), 0);
    if (data.length === 1 && (data[0]?.shipCtn || 0) === 0 && (data[0]?.shipPcs || 0) === 0) {
        errors.push('Row 1: QUANTITY SHIPPED CTNS and PCS/DOZS cannot both be 0 when only one row is entered.');
    }
    data.forEach(r => {
        let hsCode = String(r.hs || '').trim();
        if (hsCode === '') {
            errors.push(`Row ${r.item}: CUSDEC DETAILS HS CODE cannot be empty.`);
        } else if (!/^\d{8}$/.test(hsCode)) {
            errors.push(`Row ${r.item}: CUSDEC DETAILS HS CODE must be exactly 8 numbers.`);
        }
        ['shipCtn', 'shipPcs', 'fob'].forEach(k => {
            if (String(r[k + 'Raw'] ?? '').trim() === '') {
                const name = {
                    shipCtn: 'QUANTITY SHIPPED CTNS',
                    shipPcs: 'QUANTITY SHIPPED PCS/DOZS',
                    fob: (isNoShipInvoiceMode() ? 'FOB VALUE OF THE CUSDEC' : 'VALUE OF THE SHIP INVOICE')
                } [k];
                errors.push(`Row ${r.item}: ${name} cannot be empty.`);
            }
        });
        if (isNoShipInvoiceMode() && r.cusPcs <= 0) {
            errors.push(`Row ${r.item}: CUSDEC DETAILS PCS/DOZS must be greater than 0 for NO Ship Invoice calculation.`);
        }
        if (r.shipCtn > r.cusCtn) {
            errors.push(`Row ${r.item}: QUANTITY SHIPPED CTNS (${r.shipCtn}) cannot be greater than CUSDEC CTNS (${r.cusCtn}).`)
        }
        if (r.shipPcs > r.cusPcs) {
            errors.push(`Row ${r.item}: QUANTITY SHIPPED PCS/DOZS (${r.shipPcs}) cannot be greater than CUSDEC PCS/DOZS (${r.cusPcs}).`)
        }
        if (r.cusCtn > r.cusPcs) {
            errors.push(`Row ${r.item}: CUSDEC CTNS (${r.cusCtn}) cannot be greater than CUSDEC PCS/DOZS (${r.cusPcs}).`)
        }
        if (r.shipCtn > r.shipPcs) {
            errors.push(`Row ${r.item}: QUANTITY SHIPPED CTNS (${r.shipCtn}) cannot be greater than QUANTITY SHIPPED PCS/DOZS (${r.shipPcs}).`)
        }
    });
    if (String(mergedEntryRaw('gross')).trim() === '') errors.push('GROSS WEIGHT cannot be empty.');
    if (String(mergedEntryRaw('net')).trim() === '') errors.push('NET WEIGHT cannot be empty.');
    if (totalNet > totalGross) {
        errors.push(`NET WEIGHT (${totalNet}) cannot be greater than GROSS WEIGHT (${totalGross}).`)
    }
    if (isEnterDvalMode()) {
        if (String(mergedEntryRaw('dval')).trim() === '') errors.push('D.Value cannot be empty when Remittance Type is ENTER D.Val.');
        if (String(mergedEntryRaw('dval')).trim() !== '' && totalDval >= totalFob) {
            errors.push(`D.Value (${money(totalDval)}) must be less than VALUE OF THE SHIP INVOICE (${money(totalFob)}).`);
        }
    }
    let cRows = containersEnabled() ? containerRows() : [];
    cRows.forEach(c => {
        let containerNo = String(c.container || '').trim();
        if (containerNo && !/^[A-Za-z0-9]{11}$/.test(containerNo)) {
            errors.push(`Container Row ${c.item}: Container No. must be exactly 11 letters/numbers. Current length is ${containerNo.length}.`);
        }
        if (containerNo === '' && (c.ctns || c.pcs || c.gw || c.nw)) {
            errors.push(`Container Row ${c.item}: Container No. cannot be empty when container details are entered.`);
        }
        if (c.nw > c.gw) {
            errors.push(`Container Row ${c.item}: N.W (${c.nw}) cannot be greater than G.W (${c.gw}).`)
        }
    });
    let printableRows = cRows.filter(r => String(r.nos || '').trim());
    if (printableRows.length >= 1) {
        let ship = data.reduce((a, r) => ({
            ctns: a.ctns + r.shipCtn,
            pcs: a.pcs + r.shipPcs,
            gw: totalGross,
            nw: totalNet
        }), {
            ctns: 0,
            pcs: 0,
            gw: 0,
            nw: 0
        });
        let cont = printableRows.reduce((a, r) => ({
            ctns: a.ctns + r.ctns,
            pcs: a.pcs + r.pcs,
            gw: a.gw + r.gw,
            nw: a.nw + r.nw
        }), {
            ctns: 0,
            pcs: 0,
            gw: 0,
            nw: 0
        });
        if (cont.ctns !== ship.ctns) {
            errors.push(`Container total CTNS (${cont.ctns}) must equal QUANTITY SHIPPED CTNS (${ship.ctns}).`)
        }
        if (cont.pcs !== ship.pcs) {
            errors.push(`Container total PCS (${cont.pcs}) must equal QUANTITY SHIPPED PCS/DOZS (${ship.pcs}).`)
        }
        if (Math.abs(cont.gw - ship.gw) > 0.01) {
            errors.push(`Container total G.W (${cont.gw.toFixed(2)}) must equal QUANTITY SHIPPED GROSS WEIGHT (${ship.gw.toFixed(2)}).`)
        }
        if (Math.abs(cont.nw - ship.nw) > 0.01) {
            errors.push(`Container total N.W (${cont.nw.toFixed(2)}) must equal QUANTITY SHIPPED NET WEIGHT (${ship.nw.toFixed(2)}).`)
        }
    }
    const box = document.querySelector('#errorBox');
    if (box) {
        box.innerHTML = errors.map(e => `<div>${e}</div>`).join('');
        box.style.display = errors.length ? 'block' : 'none'
    }
    return errors;
}

function calc() {
    seedDValueSample();
    updateDesignationByRep();
    updateCertPagePrintOption();
    syncCusdecRows();
    updatePrintTimestamp();
    toggleDvalMode();
    applyMergedEntryCells();
    let data = rows();
    let shipmentTotals = {
        shipCtn: data.reduce((total, row) => total + (row.shipCtn || 0), 0),
        shipPcs: data.reduce((total, row) => total + (row.shipPcs || 0), 0),
        gross: mergedEntryNumber('gross'),
        net: mergedEntryNumber('net')
    };
    syncSingleContainerFromShipment(shipmentTotals);
    let errors = validateRows(data);
    let totalGross = mergedEntryNumber('gross');
    let totalNet = mergedEntryNumber('net');
    let totalDval = mergedEntryNumber('dval');
    let totalFobInput = mergedEntryNumber('fob');
    let totalCusPcs = data.reduce((a, r) => a + (r.cusPcs || 0), 0);
    let t = {
        cusCtn: 0,
        cusPcs: 0,
        shipCtn: 0,
        shipPcs: 0,
        fob: 0,
        cusdecFob: isNoShipInvoiceMode() ? totalFobInput : 0,
        dval: isEnterDvalMode() ? totalDval : 0,
        gross: totalGross,
        net: totalNet,
        shortCtn: 0,
        shortPcs: 0
    };
    [...tbody.querySelectorAll('tr')].forEach((tr, i) => {
        let r = rowObj(tr, i);
        tr.querySelector('[data-k="shortCtn"]').textContent = r.shortCtn;
        tr.querySelector('[data-k="shortPcs"]').textContent = r.shortPcs
    });
    let totalShipPcs = data.reduce((a, r) => a + (r.shipPcs || 0), 0);
    let pr = '',
        cr = '';
    data.forEach(r => {
        let printFob = isNoShipInvoiceMode() ? (totalCusPcs ? ((totalFobInput / totalCusPcs) * (r.shipPcs || 0)) : 0) : rowPrintFobValue(r);
        let rowGross = distributedGrossForRow(r, totalShipPcs, totalGross);
        let rowNet = distributedNetForRow(r, totalShipPcs, totalNet);
        t.cusCtn += r.cusCtn || 0;
        t.cusPcs += r.cusPcs || 0;
        t.shipCtn += r.shipCtn || 0;
        t.shipPcs += r.shipPcs || 0;
        t.fob += printFob || 0;
        if (!isNoShipInvoiceMode()) t.cusdecFob += r.fob || 0;
        if (!isEnterDvalMode()) t.dval += r.dval || 0;
        t.shortCtn += r.shortCtn || 0;
        t.shortPcs += r.shortPcs || 0;
        pr += `<tr><td>${r.item}</td><td>${r.hs}</td><td>${r.shortCtn}</td><td>${r.shortPcs}</td><td>${r.shipCtn}</td><td>${r.shipPcs}</td><td>${money(printFob)}</td><td>${money(rowGross)}</td><td>${money(rowNet)}</td></tr>`;
        cr += `<tr><td>${r.item}</td><td>${r.shipCtn}</td><td>${r.shipPcs}</td><td>${money(rowGross)}</td><td>${money(rowNet)}</td></tr>`;
    });
    ['CusCtn', 'CusPcs', 'ShipCtn', 'ShipPcs', 'ShortCtn', 'ShortPcs'].forEach(k => document.querySelector('#in' + k).textContent = num(t[k.charAt(0).toLowerCase() + k.slice(1)]));
    document.querySelector('#inFob').textContent = money(isNoShipInvoiceMode() ? t.cusdecFob : t.fob);
    let fPrev = document.querySelector('#fobPreview');
    if (fPrev) fPrev.textContent = money(t.fob);
    let inD = document.querySelector('#inDval');
    if (inD) inD.textContent = money(t.dval);
    document.querySelector('#inGross').textContent = money(t.gross);
    document.querySelector('#inNet').textContent = money(t.net);
    document.querySelector('#printRows').innerHTML = pr;
    document.querySelector('#certRows').innerHTML = cr;
    document.querySelector('#tShortCtn').textContent = num(t.shortCtn);
    document.querySelector('#tShortPcs').textContent = num(t.shortPcs);
    document.querySelector('#tShipCtn').textContent = num(t.shipCtn);
    document.querySelector('#tShipPcs').textContent = num(t.shipPcs);
    document.querySelector('#tFob').textContent = money(t.fob);
    document.querySelector('#tGross').textContent = money(t.gross);
    document.querySelector('#tNet').textContent = money(t.net);
    let deduction = Number(document.querySelector('#deduction').value) || 0;
    let type = document.querySelector('#formType').value;
    let dval = type === 'enter-dval' ? t.dval : ((type === 'remittance' || type === 'no-ship-invoice') ? t.fob * (1 - deduction / 100) : t.fob);
    document.querySelector('#dval').textContent = dvalFormat(dval);
    let first = data[0]?.cusdec || '';
    document.querySelector('#firstCusdec').textContent = first;
    document.querySelector('#certCusdec').textContent = first;
    let cData = printableContainerRows();
    let cPrint = document.querySelector('#containerPrint');
    if (cPrint) {
        cPrint.innerHTML = cData.map(r => `<div>${formatContainerLine(r)}</div>`).join('');
        cPrint.style.display = cData.length ? 'inline-block' : 'none';
    }
    document.querySelectorAll('[data-out]').forEach(el => {
        let val = '';
        if (el.dataset.out === 'date') {
            let v = document.querySelector('#docDate').value;
            if (v) {
                let [y, m, d] = v.split('-');
                val = new Date(y, m - 1, d).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }).replace(/ /g, '-')
            }
        } else if (el.dataset.out === 'dateLong') {
            let v = document.querySelector('#docDate').value;
            if (v) {
                let [y, m, d] = v.split('-');
                val = new Date(y, m - 1, d).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })
            }
        } else {
            val = document.querySelector('#' + el.dataset.out)?.value || ''
        }
        el.textContent = val
    })
}

// ============================================================
// DATA ENTRY CONTROLS AND EVENTS
// ============================================================
function removeLastRow() {
    let trs = tbody.querySelectorAll('tr');
    if (trs.length > 1) {
        trs[trs.length - 1].remove();
    }
    syncCusdecRows();
    calc();
}

function removeLastContainerRow() {
    let trs = containerTbody.querySelectorAll('tr');
    if (trs.length > 1) {
        trs[trs.length - 1].remove();
    }
    renumberContainers();
    calc();
}

function clearRows() {
    tbody.innerHTML = '';
    addRow();
    calc()
}
document.querySelector('#addRow').onclick = () => addRow();
document.querySelector('#removeRow').onclick = removeLastRow;
document.querySelector('#addContainerRow').onclick = () => addContainerRow();
document.querySelector('#removeContainerRow').onclick = removeLastContainerRow;
document.querySelector('#enableContainers').addEventListener('change', () => {
    updateContainerUi();
    calc();
});
document.querySelector('#printCertPage')?.addEventListener('change', () => {
    updateCertPagePrintOption();
    calc();
});
document.querySelector('#clearRows').onclick = clearRows;
document.querySelector('#sampleOne').onclick = () => {
    tbody.innerHTML = '';
    addRow({
        cusdec: '51870',
        hs: '61099000',
        cusCtn: 13,
        cusPcs: 511,
        shipCtn: 13,
        shipPcs: 510,
        fob: 2448,
        dval: 2435,
        gross: 105.14,
        net: 93.05
    })
};
document.querySelectorAll('input,select').forEach(i => i.addEventListener('input', calc));
document.querySelector('#repName')?.addEventListener('change', () => {
    updateDesignationByRep();
    calc();
});
document.querySelector('#repName')?.addEventListener('input', () => {
    updateDesignationByRep();
    calc();
});
// ============================================================
// EXPORTER NAMES AND STARTUP MODALS
// ============================================================
const ADD_EXPORTER_VALUE = '__ADD_NAME__';
const EXPORTER_STORAGE_KEY = 'ufi_short_shipment_exporter_names_v2';
const REMOTE_EXPORTER_CACHE_KEY = 'ufi_short_shipment_remote_exporters_v1';
const localApiUrl = 'http://127.0.0.1:8002';
const sameOriginApiUrl = window.location.protocol.startsWith('http') ? window.location.origin : '';
const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5500';
const REPRESENTATIVE_API_URL = window.SHORT_SHIPMENT_API_URL || (isLocalFrontend ? localApiUrl : sameOriginApiUrl || localApiUrl);
const ADMIN_TOKEN_KEY = 'ufi_short_shipment_admin_token_v1';

function defaultExporterNames() {
    return ['Eranga Lahiru', 'Gihan Praboda', 'Isuru Buddhika', 'Harshana', 'Sujith Srimal', 'Thilan Fernando', 'Kasun Sachintha', 'Vimukthi', 'Lakshitha', 'Devaka Hirantha'];
}

function loadExporterNames() {
    try {
        let saved = JSON.parse(localStorage.getItem(EXPORTER_STORAGE_KEY) || '[]');
        let remote = JSON.parse(localStorage.getItem(REMOTE_EXPORTER_CACHE_KEY) || '[]');
        let remoteNames = remote.map(x => typeof x === 'string' ? x : x.name);
        return [...new Set([...defaultExporterNames(), ...remoteNames, ...saved].map(x => String(x || '').trim()).filter(Boolean))];
    } catch (e) {
        return defaultExporterNames();
    }
}

async function syncExporterNamesFromApi() {
    try {
        let response = await fetch(`${REPRESENTATIVE_API_URL}/api/representatives`, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) return;
        let representatives = await response.json();
        if (!Array.isArray(representatives)) return;
        localStorage.setItem(REMOTE_EXPORTER_CACHE_KEY, JSON.stringify(representatives));
        refreshExporterNameLists(document.querySelector('#exporterName')?.value || 'Eranga Lahiru');
    } catch (error) {
        // Keep using the cached directory while offline.
    }
}

function showLoginError(message) {
    let box = document.querySelector('#loginError');
    if (box) {
        box.textContent = message;
        box.style.display = message ? 'block' : 'none';
    }
}

async function submitAdminLogin() {
    let username = document.querySelector('#adminLoginUsername');
    let password = document.querySelector('#adminLoginPassword');
    if (!username || !password) return null;

    let user = username.value.trim();
    let pass = password.value;
    if (!user || !pass) {
        showLoginError('Username and password are required.');
        return null;
    }

    try {
        let response = await fetch(`${REPRESENTATIVE_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        if (!response.ok) {
            showLoginError('Invalid username or password.');
            return null;
        }
        let result = await response.json();
        sessionStorage.setItem(ADMIN_TOKEN_KEY, result.access_token);
        document.querySelector('#loginModal').style.display = 'none';
        showLoginError('');
        return result.access_token;
    } catch (error) {
        showLoginError('API is unavailable. Representative changes cannot be authorized right now.');
        return null;
    }
}

function openLoginModal() {
    let modal = document.querySelector('#loginModal');
    let username = document.querySelector('#adminLoginUsername');
    let password = document.querySelector('#adminLoginPassword');
    if (!modal || !username || !password) return Promise.resolve(null);
    modal.style.display = 'flex';
    username.value = '';
    password.value = '';
    showLoginError('');
    return new Promise((resolve) => {
        const finish = (value) => {
            modal.style.display = 'none';
            showLoginError('');
            resolve(value);
        };

        const onSubmit = async () => {
            let token = await submitAdminLogin();
            if (token) finish(token);
        };

        let submitButton = document.querySelector('#adminLoginSubmit');
        let cancelButton = document.querySelector('#adminLoginCancel');
        if (submitButton) submitButton.onclick = onSubmit;
        if (cancelButton) cancelButton.onclick = () => finish(null);
        username.onkeydown = (event) => {
            if (event.key === 'Enter') onSubmit();
        };
        password.onkeydown = (event) => {
            if (event.key === 'Enter') onSubmit();
        };
    });
}

async function getAdminToken() {
    let token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) return token;
    return openLoginModal();
}

async function createRepresentativeInApi(representative, token) {
    let response = await fetch(`${REPRESENTATIVE_API_URL}/api/representatives`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(representative)
    });
    if (!response.ok) {
        let detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || 'Could not save representative');
    }
    return response.json();
}

let adminRepresentativeRecords = [];
let adminSignatureData = null;

function showAdminError(message) {
    let box = document.querySelector('#adminError');
    if (box) {
        box.textContent = message;
        box.style.display = message ? 'block' : 'none';
    }
}

function fillAdminRepresentative(record) {
    document.querySelector('#adminRepName').value = record?.name || '';
    document.querySelector('#adminDesignation').value = record?.designation || '';
    document.querySelector('#adminEnterprise').value = record?.enterprise || '';
    adminSignatureData = record?.signature_png || null;
}

function loadCachedRepresentativeRecords() {
    try {
        let cached = JSON.parse(localStorage.getItem(REMOTE_EXPORTER_CACHE_KEY) || '[]');
        return Array.isArray(cached) ? cached.filter(record => record && record.id && record.name) : [];
    } catch (error) {
        return [];
    }
}

function populateAdminRepresentativeSelect(records) {
    adminRepresentativeRecords = records;
    let select = document.querySelector('#adminRepresentativeSelect');
    select.innerHTML = '<option value="new">+ Add New Representative</option>';
    adminRepresentativeRecords.forEach(record => select.add(new Option(record.name, record.id)));
    select.value = 'new';
    fillAdminRepresentative(null);
}

function setAdminEditingEnabled(enabled) {
    ['#adminRepName', '#adminDesignation', '#adminEnterprise', '#adminSignature', '#adminSaveBtn']
        .forEach(selector => {
            let element = document.querySelector(selector);
            if (element) element.disabled = !enabled;
        });
}

async function openAdminSettings() {
    let token = await getAdminToken();
    if (!token) return;
    try {
        let response = await fetch(`${REPRESENTATIVE_API_URL}/api/representatives`);
        if (!response.ok) throw new Error('Could not load representatives');
        adminRepresentativeRecords = await response.json();
        localStorage.setItem(REMOTE_EXPORTER_CACHE_KEY, JSON.stringify(adminRepresentativeRecords));
        populateAdminRepresentativeSelect(adminRepresentativeRecords);
        setAdminEditingEnabled(true);
        showAdminError('');
        document.querySelector('#adminModal').style.display = 'flex';
    } catch (error) {
        let cached = loadCachedRepresentativeRecords();
        if (!cached.length) {
            showAdminError('API is unavailable. No cached representative data is available.');
            return;
        }
        populateAdminRepresentativeSelect(cached);
        setAdminEditingEnabled(false);
        showAdminError('API is unavailable. Existing data is read-only until the API is back.');
        document.querySelector('#adminModal').style.display = 'flex';
    }
}

async function saveAdminRepresentative() {
    let token = await getAdminToken();
    if (!token) return;
    let select = document.querySelector('#adminRepresentativeSelect');
    let id = select.value === 'new' ? null : Number(select.value);
    let payload = {
        name: document.querySelector('#adminRepName').value.trim(),
        designation: document.querySelector('#adminDesignation').value.trim(),
        enterprise: document.querySelector('#adminEnterprise').value.trim(),
        signature_png: adminSignatureData
    };
    if (!payload.name || !payload.designation || !payload.enterprise) {
        showAdminError('Name, Designation and Enterprise are required.');
        return;
    }
    let url = id ? `${REPRESENTATIVE_API_URL}/api/representatives/${id}` : `${REPRESENTATIVE_API_URL}/api/representatives`;
    try {
        let response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            let detail = await response.json().catch(() => ({}));
            throw new Error(detail.detail || 'Could not save representative');
        }
        await syncExporterNamesFromApi();
        await openAdminSettings();
        alert('Representative saved.');
    } catch (error) {
        showAdminError(error.message);
    }
}

document.querySelector('#adminSettingsBtn')?.addEventListener('click', async () => {
    let token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
        await openAdminSettings();
        return;
    }
    if (await openLoginModal()) await openAdminSettings();
});
document.querySelector('#adminCloseBtn')?.addEventListener('click', () => {
    document.querySelector('#adminModal').style.display = 'none';
});
document.querySelector('#adminRepresentativeSelect')?.addEventListener('change', e => {
    let record = adminRepresentativeRecords.find(item => String(item.id) === e.target.value);
    fillAdminRepresentative(record);
});
document.querySelector('#adminSaveBtn')?.addEventListener('click', saveAdminRepresentative);
document.querySelector('#adminSignature')?.addEventListener('change', e => {
    let file = e.target.files?.[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = () => { adminSignatureData = reader.result; };
    reader.readAsDataURL(file);
});

function saveExporterName(name) {
    name = String(name || '').trim();
    if (!name) return;
    let names = loadExporterNames();
    if (!names.includes(name)) names.push(name);
    try {
        localStorage.setItem(EXPORTER_STORAGE_KEY, JSON.stringify(names.filter(n => !defaultExporterNames().includes(n))))
    } catch (e) {}
    refreshExporterNameLists(name);
}

function refreshExporterNameLists(selectedName) {
    let names = loadExporterNames();
    document.querySelectorAll('.exporter-name-select').forEach(sel => {
        let current = selectedName || sel.value || 'Eranga Lahiru';
        sel.innerHTML = '';
        names.forEach(name => {
            let opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
        });
        sel.value = names.includes(current) ? current : names[0];
    });
}

async function handleExporterNameChange(e) {
    let sel = e.target;
    if (!sel || sel.value !== ADD_EXPORTER_VALUE) return;
    let previous = document.querySelector('#exporterName')?.value || 'Eranga Lahiru';
    let token = await getAdminToken();
    if (!token) {
        refreshExporterNameLists(previous);
        return;
    }
    let newName = prompt('Enter new Exporter / Authorized Rep. name:');
    newName = String(newName || '').trim();
    if (newName) {
        let designation = prompt('Enter Designation:') || 'Assistant Manager - Commercial & Logistic';
        let enterprise = prompt('Enter Enterprise:') || 'MAS CAPITAL PVT LTD';
        try {
            await createRepresentativeInApi({ name: newName, designation, enterprise }, token);
            saveExporterName(newName);
            await syncExporterNamesFromApi();
            document.querySelectorAll('.exporter-name-select').forEach(x => x.value = newName);
            calc();
        } catch (error) {
            alert(error.message);
            refreshExporterNameLists(previous);
        }
    } else {
        refreshExporterNameLists(previous);
    }
}

function initExporterNameLists() {
    refreshExporterNameLists('Eranga Lahiru');
}

function showRemittancePopup() {
    let modal = document.querySelector('#remittanceModal');
    if (modal) modal.style.display = 'flex';
}

function applyModalRemittance() {
    let sel = document.querySelector('#modalRemittanceType');
    let form = document.querySelector('#formType');
    if (sel && form) {
        form.value = sel.value;
    }
    autoRepByRemittanceType();
    toggleDvalMode();
    seedDValueSample();
    calc();
    let modal = document.querySelector('#remittanceModal');
    if (modal) modal.style.display = 'none';
    let exporterModal = document.querySelector('#exporterModal');
    if (exporterModal) exporterModal.style.display = 'flex';
}
document.querySelector('#modalStart')?.addEventListener('click', applyModalRemittance);

function applyExporterSelection() {
    let sel = document.querySelector('#modalExporterName');
    let out = document.querySelector('#exporterName');
    if (sel && sel.value === ADD_EXPORTER_VALUE) {
        handleExporterNameChange({
            target: sel
        });
        let modal = document.querySelector('#exporterModal');
        if (modal) modal.style.display = 'none';
        return;
    }
    if (sel && out) {
        refreshExporterNameLists(sel.value);
        out.value = sel.value;
    }
    calc();
    let modal = document.querySelector('#exporterModal');
    if (modal) modal.style.display = 'none';
}
document.querySelector('#exporterStart')?.addEventListener('click', applyExporterSelection);

document.querySelector('#formType')?.addEventListener('change', () => {
    autoRepByRemittanceType();
    toggleDvalMode();
    seedDValueSample();
    calc();
});
today();
addContainerRow({
    nos: '01',
    container: 'ERAN251825',
    ctns: 13,
    pcs: 510,
    gw: 105.14,
    nw: 93.05
});
addRow({
    cusdec: '51870',
    hs: '61099000',
    cusCtn: 13,
    cusPcs: 511,
    shipCtn: 13,
    shipPcs: 510,
    fob: 2448,
    dval: 2435,
    gross: 105.14,
    net: 93.05
});
updateContainerUi();
// ============================================================
// PRINTING AND PRINT-LAYOUT STATE
// ============================================================
// Hide browser print header title as much as possible. If browser still shows headers, turn off 'Headers and footers' in print settings.
async function attemptPrint() {
    let errs = validateRows(rows());
    if (errs.length) {
        alert('Please fix these errors before printing:\n\n' + errs.join('\n'));
        return false;
    }
    await savePdfIfPossible();
    window.print();
    return true;
}
document.querySelector('#printBtn')?.addEventListener('click', () => attemptPrint());
let __oldTitle = document.title;
window.addEventListener('beforeprint', () => {
    updateCertPagePrintOption();
    updatePrintTimestamp();
    __oldTitle = document.title;
    document.title = 'UNIVERSAL FREIGHTERS INTERNATIONAL (PVT) LTD.';
    let errs = validateRows(rows());
    document.body.classList.toggle('print-blocked', errs.length > 0);
    if (errs.length) {
        alert('Please fix these errors before printing:\n\n' + errs.join('\n'));
    }
});
window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-blocked');
    document.title = __oldTitle || 'UNIVERSAL FREIGHTERS INTERNATIONAL (PVT) LTD.';
});
// Show startup popups only once per page load.
let __startupPopupShown = false;

function runStartupPopupsOnce() {
    if (__startupPopupShown) return;
    __startupPopupShown = true;
    toggleDvalMode();
    setTimeout(showRemittancePopup, 100);
}
runStartupPopupsOnce();

updateCertPagePrintOption(); // v34 init

updateDesignationByRep(); // v40 init

autoRepByRemittanceType(); // v43 init

initExporterNameLists(); // v49 init
syncExporterNamesFromApi();

document.querySelector('#exporterName')?.addEventListener('change', calc);


// ============================================================
// PDF AUTO-SAVE
// ============================================================
/* v55: optional auto-save PDF copy to selected folder before printing */
const PDF_FOLDER_DB = 'ufi_short_shipment_pdf_folder_db_v1';
const PDF_FOLDER_STORE = 'handles';
const PDF_FOLDER_KEY = 'saveFolder';

function pdfApiSupported() {
    return 'showDirectoryPicker' in window && 'indexedDB' in window;
}

function openPdfDb() {
    return new Promise((resolve, reject) => {
        let req = indexedDB.open(PDF_FOLDER_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(PDF_FOLDER_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function storePdfFolderHandle(handle) {
    let db = await openPdfDb();
    return new Promise((resolve, reject) => {
        let tx = db.transaction(PDF_FOLDER_STORE, 'readwrite');
        tx.objectStore(PDF_FOLDER_STORE).put(handle, PDF_FOLDER_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function loadPdfFolderHandle() {
    try {
        let db = await openPdfDb();
        return await new Promise((resolve, reject) => {
            let tx = db.transaction(PDF_FOLDER_STORE, 'readonly');
            let req = tx.objectStore(PDF_FOLDER_STORE).get(PDF_FOLDER_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return null;
    }
}
async function verifyPdfPermission(handle, requestAccess) {
    if (!handle) return false;
    let opts = {
        mode: 'readwrite'
    };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if (requestAccess && (await handle.requestPermission(opts)) === 'granted') return true;
    return false;
}

function setPdfStatus(txt, ok) {
    let el = document.querySelector('#pdfFolderStatus');
    if (!el) return;
    el.textContent = txt;
    el.style.background = ok ? 'rgba(0,120,0,.55)' : 'rgba(0,0,0,.18)';
}
async function setPdfSaveFolder() {
    if (!pdfApiSupported()) {
        alert('This browser does not support folder auto-save. Please use Microsoft Edge or Google Chrome.');
        return;
    }
    try {
        let h = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        if (!(await verifyPdfPermission(h, true))) {
            alert('Folder permission was not granted. PDF auto-save will stay off.');
            setPdfStatus('PDF folder not set', false);
            return;
        }
        await storePdfFolderHandle(h);
        setPdfStatus('PDF folder set', true);
        alert('PDF save folder set. From now on, Print / Save PDF or Ctrl+P will save a PDF copy first.');
    } catch (e) {
        if (e && e.name !== 'AbortError') alert('Could not set PDF folder: ' + e.message);
    }
}

function filenameSafe(v) {
    return String(v || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'NO_CUSDEC';
}

function firstCusdecForPdf() {
    let r = rows()[0];
    let v = (r && r.cusdec) || document.querySelector('#firstCusdec')?.textContent || 'NO_CUSDEC';
    return filenameSafe(v);
}

function getOutValue(id) {
    let el = document.querySelector('#' + id);
    return el ? el.value : '';
}

function pdfEscape(s) {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function currentPrintLines() {
    calc();
    let data = rows();
    let lines = [];
    let type = document.querySelector('#formType')?.selectedOptions?.[0]?.textContent || '';
    lines.push('UNIVERSAL FREIGHTERS INTERNATIONAL (PVT) LTD.');
    lines.push('SHORT SHIPMENT DECLARATION');
    lines.push('CUSDEC No: ' + firstCusdecForPdf());
    lines.push('Date: ' + (document.querySelector('[data-out="date"]')?.textContent || ''));
    lines.push('Invoice No: ' + getOutValue('invoice'));
    lines.push('Enterprise: ' + getOutValue('enterprise'));
    lines.push('Exporter / Authorized Rep: ' + getOutValue('exporterName'));
    lines.push('Remittance Type: ' + type);
    lines.push('Rep Name: ' + getOutValue('repName'));
    lines.push('Designation: ' + getOutValue('designation'));
    lines.push('');
    lines.push('ITEM | HS CODE | SHORT CTN | SHORT PCS | SHIP CTN | SHIP PCS | FOB | GROSS | NET');
    let totalGross = mergedEntryNumber('gross');
    let totalNet = mergedEntryNumber('net');
    let totalShipPcs = data.reduce((a, r) => a + (r.shipPcs || 0), 0);
    data.forEach(r => {
        lines.push([r.item, r.hs, r.shortCtn, r.shortPcs, r.shipCtn, r.shipPcs, money(rowPrintFobValue(r)), money(distributedGrossForRow(r, totalShipPcs, totalGross)), money(distributedNetForRow(r, totalShipPcs, totalNet))].join(' | '));
    });
    lines.push('');
    lines.push('TOTAL SHORT CTN: ' + (document.querySelector('#tShortCtn')?.textContent || ''));
    lines.push('TOTAL SHORT PCS: ' + (document.querySelector('#tShortPcs')?.textContent || ''));
    lines.push('TOTAL SHIPPED CTN: ' + (document.querySelector('#tShipCtn')?.textContent || ''));
    lines.push('TOTAL SHIPPED PCS: ' + (document.querySelector('#tShipPcs')?.textContent || ''));
    lines.push('D.VALUE: ' + (document.querySelector('#dval')?.textContent || ''));
    lines.push('');
    lines.push('Container No. / Nos.: ' + Array.from(document.querySelectorAll('#containerPrint div')).map(x => x.textContent).join(' ; '));
    lines.push('');
    lines.push('Saved automatically before print. Use the browser print dialog for the official print/PDF layout.');
    return lines;
}

function buildSimplePdf(lines) {
    let pageLines = [];
    let maxLines = 48;
    for (let i = 0; i < lines.length; i += maxLines) pageLines.push(lines.slice(i, i + maxLines));
    let objs = [];

    function add(s) {
        objs.push(s);
        return objs.length;
    }
    let pages = [];
    let fontObj = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    pageLines.forEach(pl => {
        let y = 790;
        let content = 'BT /F1 9 Tf 36 ' + y + ' Td ';
        pl.forEach((line, idx) => {
            if (idx > 0) content += '0 -14 Td ';
            content += '(' + pdfEscape(line).slice(0, 110) + ') Tj ';
        });
        content += 'ET';
        let contObj = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
        let pageObj = add('<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' + fontObj + ' 0 R >> >> /Contents ' + contObj + ' 0 R >>');
        pages.push(pageObj);
    });
    let pagesObj = add('<< /Type /Pages /Kids [' + pages.map(p => p + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
    let catalogObj = add('<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>');
    pages.forEach(p => {
        objs[p - 1] = objs[p - 1].replace('/Parent 0 0 R', '/Parent ' + pagesObj + ' 0 R');
    });
    let pdf = '%PDF-1.4\n';
    let offsets = [0];
    objs.forEach((o, i) => {
        offsets.push(pdf.length);
        pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
    });
    let xref = pdf.length;
    pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    pdf += 'trailer << /Size ' + (objs.length + 1) + ' /Root ' + catalogObj + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return new Blob([pdf], {
        type: 'application/pdf'
    });
}
async function uniquePdfHandle(dir, baseName) {
    let name = baseName + '.pdf';
    for (let i = 0; i < 100; i++) {
        let candidate = i ? baseName + '_' + i + '.pdf' : name;
        try {
            await dir.getFileHandle(candidate, {
                create: false
            });
        } catch (e) {
            return await dir.getFileHandle(candidate, {
                create: true
            });
        }
    }
    return await dir.getFileHandle(baseName + '_' + Date.now() + '.pdf', {
        create: true
    });
}
async function savePdfIfPossible() {
    if (!pdfApiSupported()) return false;
    let h = await loadPdfFolderHandle();
    if (!h) return false;
    let ok = false;
    try {
        ok = await verifyPdfPermission(h, true);
    } catch (e) {
        ok = false;
    }
    if (!ok) {
        setPdfStatus('PDF folder not set', false);
        return false;
    }
    let cus = firstCusdecForPdf();
    let base = 'SHORT_SHIPMENT_' + cus;
    let fileHandle = await uniquePdfHandle(h, base);
    let writable = await fileHandle.createWritable();
    await writable.write(buildSimplePdf(currentPrintLines()));
    await writable.close();
    setPdfStatus('Saved ' + base + '.pdf', true);
    return true;
}
document.querySelector('#setPdfFolderBtn')?.addEventListener('click', setPdfSaveFolder);
loadPdfFolderHandle().then(async h => {
    if (h && await verifyPdfPermission(h, false)) setPdfStatus('PDF folder set', true);
});
document.addEventListener('keydown', async e => {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'p') {
        let h = await loadPdfFolderHandle();
        if (h && await verifyPdfPermission(h, false)) {
            e.preventDefault();
            attemptPrint();
        }
    }
}, {
    capture: true
});