const app = {
    // State
    db: JSON.parse(localStorage.getItem('patrimonio_final_v10')) || [],
    rates: JSON.parse(localStorage.getItem('patrimonio_rates')) || { usd: 36.5, eur: 39.27, bin: 37.8, par: 38.5 },
    mode: 'USD',
    activeKey: 'usd',
    // Monthly Filtering State
    currMonth: new Date().getMonth(),
    currYear: new Date().getFullYear(),

    // Initialization
    init: async function () {
        await this.loadRates();
        this.render();
        this.updateMonthUI();
    },

    // API Service
    loadRates: async function () {
        const syncEl = document.getElementById('sync');
        try {
            // Maxwell: Fetch BCV Data (Official & Parallel)
            const resVal = await fetch('https://ve.dolarapi.com/v1/dolares');
            const dataVal = await resVal.json();

            // Maxwell: Fetch Global Rates (for Cross-Calculation)
            const resGlob = await fetch('https://open.er-api.com/v6/latest/USD');
            const dataGlob = await resGlob.json();

            // Map API data to local state
            this.rates.usd = dataVal.find(d => d.nombre === 'Oficial')?.promedio || this.rates.usd;
            this.rates.par = dataVal.find(d => d.nombre === 'Paralelo')?.promedio || this.rates.par;

            // Euro fetch (Calculated: BCV_USD / Global_EUR_Rate)
            const eurRate = dataGlob.rates.EUR;
            if (eurRate) {
                this.rates.eur = this.rates.usd / eurRate;
            }

            // Derive Binance (approx) if not in API
            this.rates.bin = this.rates.par - 0.25;

            // Persist rates for offline use
            localStorage.setItem('patrimonio_rates', JSON.stringify(this.rates));

            // UI Update
            syncEl.innerHTML = '<span class="dot" style="background:#2ecc71; animation:none"></span> TASAS AL DÍA';
            syncEl.style.color = '#2ecc71';
            this.updateRateUI();
        } catch (e) {
            console.error("Modo Offline: Usando tasas guardadas", e);
            syncEl.innerHTML = '<span class="dot" style="background:#f39c12; animation:none"></span> MODO OFFLINE (Tasas Guardadas)';
            syncEl.style.color = '#f39c12';
            this.updateRateUI(); // Render with cached/default rates
        }
    },

    updateRateUI: function () {
        document.getElementById('v-usd').innerText = this.rates.usd.toFixed(2);
        document.getElementById('v-eur').innerText = this.rates.eur.toFixed(2);
        document.getElementById('v-bin').innerText = this.rates.bin.toFixed(2);
        document.getElementById('v-par').innerText = this.rates.par.toFixed(2);

        // Update Converter Badge
        const badge = document.getElementById('rate-tag');
        if (badge) {
            const sym = this.activeKey.toUpperCase();
            badge.innerText = `1 ${sym} = ${this.rates[this.activeKey].toLocaleString('es-VE')} Bs`;
        }

        this.calcFromUsd(); // Refresh calc if rates changed
        this.render();
    },

    // Actions
    setMode: function (m) {
        this.mode = m;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        const btnId = `m-${m.toLowerCase()}`;
        if (document.getElementById(btnId)) {
            document.getElementById(btnId).classList.add('active');
        }
        this.render();
    },

    setRate: function (k) {
        this.activeKey = k;
        document.querySelectorAll('.rate-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`c-${k}`).classList.add('active');
        this.updateRateUI();
    },

    parseAmt: function (v) {
        if (!v) return 0;
        return parseFloat(String(v).replace(',', '.'));
    },

    calcFromUsd: function () {
        const u = document.getElementById('q-usd');
        const b = document.getElementById('q-bs');
        const val = this.parseAmt(u.value);
        const r = this.rates[this.activeKey];
        if (!isNaN(val) && u.value !== '') b.value = (val * r).toFixed(2);
        else b.value = '';
    },

    calcFromBs: function () {
        const u = document.getElementById('q-usd');
        const b = document.getElementById('q-bs');
        const val = this.parseAmt(b.value);
        const r = this.rates[this.activeKey];
        if (!isNaN(val) && b.value !== '') u.value = (val / r).toFixed(2);
        else u.value = '';
    },

    copyVal: function (id) {
        const el = document.getElementById(id);
        if (!el || !el.value) return;

        navigator.clipboard.writeText(el.value).then(() => {
            const originalVal = el.value;
            const originalColor = el.style.color;
            el.value = "COPIADO";
            el.style.color = "var(--gold)";
            setTimeout(() => {
                el.value = originalVal;
                el.style.color = originalColor;
            }, 800);
        });
    },

    changeMonth: function (dir) {
        this.currMonth += dir;
        if (this.currMonth > 11) {
            this.currMonth = 0;
            this.currYear++;
        } else if (this.currMonth < 0) {
            this.currMonth = 11;
            this.currYear--;
        }
        this.updateMonthUI();
        this.render();
    },

    updateMonthUI: function () {
        const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const monthEl = document.getElementById('current-month-display');
        if (monthEl) {
            monthEl.innerText = `${months[this.currMonth]} ${this.currYear}`;
        }
    },

    toggleForm: function () {
        const sheet = document.getElementById('form-sheet');
        const overlay = document.getElementById('form-overlay');
        const fab = document.getElementById('fab-btn');

        if (!sheet || !overlay || !fab) return;

        sheet.classList.toggle('active');
        overlay.classList.toggle('active');

        if (sheet.classList.contains('active')) {
            fab.innerText = '×';
            fab.style.boxShadow = '0 5px 15px rgba(231, 76, 60, 0.4)';
        } else {
            fab.innerText = '+';
            fab.style.boxShadow = '0 10px 30px rgba(46, 204, 113, 0.4)';
        }
    },

    add: function () {
        const descInput = document.getElementById('desc');
        const amtInput = document.getElementById('amt');
        const catInput = document.getElementById('cat');

        const d = descInput.value;
        const a = this.parseAmt(amtInput.value);
        const c = catInput.value;

        if (!d || isNaN(a)) {
            alert("Por favor ingrese un concepto y un monto válido.");
            return;
        }

        const now = new Date();
        const tx = {
            id: Date.now(),
            date: now.toLocaleDateString('es-VE'),
            month: now.getMonth(),
            year: now.getFullYear(),
            desc: d,
            amt: a,
            type: document.getElementById('type').value,
            curr: document.getElementById('curr').value,
            cat: c // V11 Category
        };

        this.db.push(tx);
        localStorage.setItem('patrimonio_final_v10', JSON.stringify(this.db));

        // Reset inputs
        descInput.value = '';
        amtInput.value = '';

        // Auto-close form on mobile after adding
        if (window.innerWidth < 768) this.toggleForm();

        this.render();
    },

    exportCSV: function () {
        if (this.db.length === 0) return alert("No hay datos para exportar");

        let csv = "ID,Fecha,Concepto,Categoria,Tipo,Monto,Moneda\n";
        this.db.forEach(t => {
            csv += `${t.id},${t.date},"${t.desc}","${t.cat || 'Otros'}",${t.type},${t.amt},${t.curr}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `PatrimonioPro_Backup_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    // Rendering
    render: function () {
        const t = document.getElementById('tbody');
        if (!t) return;
        t.innerHTML = '';

        const query = (document.getElementById('query')?.value || '').toLowerCase();
        let nUSD = 0;
        let nBS = 0;

        // Stats for current month
        let monthIn = 0;
        let monthOut = 0;

        const r = this.rates[this.activeKey];

        // 1. Calculations
        this.db.forEach(i => {
            const mult = i.type === 'out' ? -1 : 1;

            // Global Totals
            if (i.curr === 'USD') nUSD += (i.amt * mult);
            else nBS += (i.amt * mult);

            // Monthly Stats (Normalized to current mode for comparison)
            const itemDate = i.month !== undefined ? { month: i.month, year: i.year } : this.parseDate(i.date);
            if (itemDate.month === this.currMonth && itemDate.year === this.currYear) {
                // Convert to "Visual Mode" currency for the month stats
                let val = i.amt;
                if (i.curr !== this.mode) {
                    val = this.mode === 'USD' ? i.amt / r : i.amt * r;
                }

                if (i.type === 'in') monthIn += val;
                else monthOut += val;
            }
        });

        // 2. Filter Transactions for Table
        const filtered = this.db.filter(i => {
            const itemDate = i.month !== undefined ? { month: i.month, year: i.year } : this.parseDate(i.date);
            const matchesMonth = itemDate.month === this.currMonth && itemDate.year === this.currYear;
            const matchesMode = i.curr === this.mode;
            const matchesQuery = i.desc.toLowerCase().includes(query) || (i.cat || '').toLowerCase().includes(query);
            return matchesMonth && matchesMode && matchesQuery;
        });

        filtered.sort((a, b) => b.id - a.id);

        const isMobile = window.innerWidth < 768;

        filtered.forEach(i => {
            const row = document.createElement('tr');
            let dynTxt;
            if (this.mode === 'USD') {
                let valInBs = i.amt * r;
                dynTxt = (i.type === 'out' ? '-' : '') + valInBs.toLocaleString('es-VE') + " Bs";
            } else {
                let valInUsd = i.amt / r;
                dynTxt = (i.type === 'out' ? '-' : '') + "$ " + valInUsd.toFixed(2);
            }

            if (isMobile) {
                // Mobile Card View
                const card = document.createElement('div');
                card.className = 'tx-card';
                card.innerHTML = `
                    <div class="card-top">
                        <span class="card-date">${i.date}</span>
                        <span class="card-cat">${i.cat || 'Otros'}</span>
                    </div>
                    <div class="card-body">
                        <div class="card-info">
                            <div class="card-desc">${i.desc}</div>
                            <div class="card-type ${i.type === 'out' ? 'gasto' : 'ingreso'}">${i.type === 'in' ? 'INGRESO' : 'GASTO'}</div>
                        </div>
                        <div class="card-amounts">
                            <div class="card-fixed ${i.type === 'out' ? 'gasto' : 'ingreso'}">
                                ${i.type === 'out' ? '-' : ''}${i.amt.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${i.curr}
                            </div>
                            <div class="card-dyn">${dynTxt}</div>
                        </div>
                    </div>
                    <button class="card-remove" onclick="app.remove(${i.id})">ELIMINAR</button>
                `;
                t.appendChild(card);
            } else {
                // Desktop Table View
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${i.date}</td>
                    <td>
                        <div style="font-weight: 600">${i.desc}</div>
                        <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase">${i.cat || 'Otros'}</div>
                    </td>
                    <td class="${i.type === 'out' ? 'gasto' : 'ingreso'}">
                        <span style="background:${i.type === 'out' ? 'var(--danger-dim)' : 'var(--emerald-dim)'}; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem;">
                            ${i.type === 'in' ? 'INGRESO' : 'GASTO'}
                        </span>
                    </td>
                    <td class="text-right ${i.type === 'out' ? 'gasto' : 'ingreso'}">
                        ${i.type === 'out' ? '-' : ''}${i.amt.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${i.curr}
                    </td>
                    <td class="text-right" style="font-weight:bold; color: var(--text-dim); font-size: 0.85em">${dynTxt}</td>
                    <td class="text-center">
                        <button class="remove-btn" onclick="app.remove(${i.id})">×</button>
                    </td>
                `;
                t.appendChild(row);
            }
        });

        // 3. Update UI
        this.updateStatsUI(nUSD, nBS, monthIn, monthOut, r);
    },

    updateStatsUI: function (nUSD, nBS, mIn, mOut, r) {
        const mainVal = document.getElementById('total-main');
        const secVal = document.getElementById('total-sec');
        const mInEl = document.getElementById('month-in');
        const mOutEl = document.getElementById('month-out');
        const mNetEl = document.getElementById('month-net');

        const currText = this.mode === 'USD' ? '$' : 'Bs';

        // Global
        if (this.mode === 'USD') {
            mainVal.innerText = "$ " + nUSD.toLocaleString('en-US', { minimumFractionDigits: 2 });
            secVal.innerText = (nUSD * r).toLocaleString('es-VE', { minimumFractionDigits: 2 }) + " Bs";
        } else {
            mainVal.innerText = nBS.toLocaleString('es-VE', { minimumFractionDigits: 2 }) + " Bs";
            secVal.innerText = "$ " + (nBS / r).toLocaleString('en-US', { minimumFractionDigits: 2 });
        }

        // Monthly
        mInEl.innerText = `${currText} ${mIn.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
        mOutEl.innerText = `${currText} ${mOut.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

        const net = mIn - mOut;
        mNetEl.innerText = `${currText} ${net.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
        mNetEl.style.color = net >= 0 ? 'var(--emerald)' : 'var(--danger)';
    },

    // Helper to parse older date strings
    parseDate: function (dateStr) {
        try {
            const parts = dateStr.split('/');
            return { month: parseInt(parts[1]) - 1, year: parseInt(parts[2]) };
        } catch (e) {
            return { month: new Date().getMonth(), year: new Date().getFullYear() };
        }
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => app.init());
