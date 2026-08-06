/**
 * Travel Ledger UI — Phase 1B.5 UX (list / step-create / edit / detail).
 * Depends on: travel-ledger-config.js, travel-ledger-forex.js, travel-ledger-data.js
 */
(function (global) {
  'use strict';

  var CONFIG = global.SOARVIBE_TRAVEL_LEDGER_CONFIG;
  var DATA = global.SOARVIBE_TRAVEL_LEDGER;
  if (!CONFIG || !DATA) {
    throw new Error('travel-ledger-ui.js requires travel-ledger data modules');
  }

  var STATUS_SORT_ORDER = {
    active: 0,
    upcoming: 1,
    ended: 2,
    archived: 3
  };

  var OTHER_GROUP_ORDER = ['upcoming', 'ended', 'archived'];

  var COUNTRY_THEME_MAP = {
    JP: 'tl-theme-jp',
    KR: 'tl-theme-kr',
    TH: 'tl-theme-th',
    US: 'tl-theme-us',
    FR: 'tl-theme-fr',
    TW: 'tl-theme-tw',
    VN: 'tl-theme-vn',
    GB: 'tl-theme-gb',
    SG: 'tl-theme-sg',
    HK: 'tl-theme-default',
    MO: 'tl-theme-default',
    CN: 'tl-theme-default',
    MY: 'tl-theme-th',
    ID: 'tl-theme-th',
    PH: 'tl-theme-us',
    AU: 'tl-theme-us',
    EU: 'tl-theme-fr'
  };

  var CREATE_STEPS = [
    { id: 'where', title: '去哪？', copy: '先選這趟旅行的國家，幣別與國旗會自動帶入。' },
    { id: 'name', title: '旅行名稱', copy: '幫這趟旅行取一個好記的名字。' },
    { id: 'dates', title: '日期', copy: '設定出發與回程，之後會自動算旅行天數。' },
    { id: 'budget', title: '預算', copy: '預算與現金都是選填，之後也能再改。' }
  ];

  var tlState = {
    view: 'closed',
    ledgerId: null,
    editId: null,
    openMenuId: null,
    phoneScrollTop: 0,
    createStep: 0,
    createDraft: null,
    expenseMode: null,
    expenseId: null,
    expenseCategory: 'food',
    expensePayment: 'cash',
    swipeOpenId: null,
    expenseSheetScrollTop: 0,
    expenseSheetLockedView: null
  };

  var toastTimer = null;
  var LAST_EXPENSE_PAYMENT_KEY = 'tlLastExpensePayment';

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function $(id) {
    return document.getElementById(id);
  }

  function parseDateOnly(isoDate) {
    if (!isoDate || typeof isoDate !== 'string') return null;
    var m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  function formatDateOnly(date) {
    var y = date.getFullYear();
    var mo = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  }

  function todayDateOnly() {
    return formatDateOnly(new Date());
  }

  function compareDateOnly(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function daysBetweenInclusive(startDate, endDate) {
    var s = parseDateOnly(startDate);
    var e = parseDateOnly(endDate);
    if (!s || !e) return 0;
    var diff = e.getTime() - s.getTime();
    if (diff < 0) return 0;
    return Math.floor(diff / 86400000) + 1;
  }

  function daysUntilStart(startDate, today) {
    var s = parseDateOnly(startDate);
    var t = parseDateOnly(today);
    if (!s || !t) return null;
    return Math.floor((s.getTime() - t.getTime()) / 86400000);
  }

  function formatDateRange(startDate, endDate) {
    if (!startDate && !endDate) return '日期未設定';
    return (startDate || '—') + ' – ' + (endDate || '—');
  }

  function formatSlashRange(startDate, endDate) {
    if (!startDate || !endDate) return formatDateRange(startDate, endDate);
    return startDate.replace(/-/g, '/') + ' – ' + endDate.replace(/-/g, '/');
  }

  function getThemeClass(countryCode) {
    var code = String(countryCode || '').toUpperCase();
    return COUNTRY_THEME_MAP[code] || 'tl-theme-default';
  }

  function getLedgerDisplayStatus(ledger, today) {
    return DATA.getLedgerTemporalState(ledger, today || todayDateOnly());
  }

  function getLedgerTemporalState(ledger, today) {
    return DATA.getLedgerTemporalState(ledger, today || todayDateOnly());
  }

  function formatMonthDayLabel(dateKey) {
    var d = parseDateOnly(dateKey);
    if (!d) return dateKey || '';
    return d.getMonth() + 1 + ' 月 ' + d.getDate() + ' 日';
  }

  function formatRemainingBudgetHero(summary, primaryCode) {
    if (summary.budgetMinor == null) {
      return {
        label: '剩餘預算',
        amountHtml: escapeHtml('尚未設定'),
        modifier: 'is-unset'
      };
    }
    if (summary.budgetOverMinor != null && summary.budgetOverMinor > 0) {
      return {
        label: '已超出預算',
        amountHtml: escapeHtml(DATA.formatMoneyMinor(summary.budgetOverMinor, primaryCode)),
        modifier: 'is-over'
      };
    }
    return {
      label: '剩餘預算',
      amountHtml: escapeHtml(DATA.formatMoneyMinor(summary.remainingBudgetMinor, primaryCode)),
      modifier: ''
    };
  }

  function formatCashHero(ledger, summary, primaryCode) {
    if (ledger.initialCashMinor == null) {
      return {
        label: '現金剩餘',
        amountHtml: escapeHtml('未設定'),
        modifier: 'is-unset'
      };
    }
    return {
      label: '現金剩餘',
      amountHtml: escapeHtml(DATA.formatMoneyMinor(summary.cashBalanceMinor, primaryCode)),
      modifier: ''
    };
  }

  function renderHeroMetricCol(label, amountHtml, modifier, labelModifier) {
    return (
      '<div class="tl-hero-summary-col">' +
      '<p class="tl-hero-summary-label' +
      (labelModifier ? ' ' + labelModifier : '') +
      '">' +
      escapeHtml(label) +
      '</p>' +
      '<p class="tl-hero-summary-amount' +
      (modifier ? ' ' + modifier : '') +
      '">' +
      amountHtml +
      '</p></div>'
    );
  }

  function renderDetailPrimarySummary(ledger, today, summary, primaryCode) {
    var state = getLedgerTemporalState(ledger, today);
    var cash = formatCashHero(ledger, summary, primaryCode);

    if (state === 'active') {
      return (
        '<div class="tl-hero-summary tl-hero-summary-dual">' +
        '<div class="tl-hero-summary-grid">' +
        renderHeroMetricCol(
          '今天已花',
          escapeHtml(DATA.formatMoneyMinor(summary.todaySpendMinor, primaryCode)),
          ''
        ) +
        renderHeroMetricCol(cash.label, cash.amountHtml, cash.modifier) +
        '</div></div>'
      );
    }

    if (state === 'ended') {
      return (
        '<div class="tl-hero-summary tl-hero-summary-dual is-ended">' +
        '<p class="tl-hero-summary-kicker">旅程已結束</p>' +
        '<div class="tl-hero-summary-grid">' +
        renderHeroMetricCol(
          '總花費',
          escapeHtml(DATA.formatMoneyMinor(summary.totalSpendMinor, primaryCode)),
          ''
        ) +
        renderHeroMetricCol(cash.label, cash.amountHtml, cash.modifier) +
        '</div></div>'
      );
    }

    if (state === 'upcoming') {
      return (
        '<div class="tl-hero-summary tl-hero-summary-upcoming">' +
        '<p class="tl-hero-summary-kicker">' +
        escapeHtml(getLedgerDayProgress(ledger, today)) +
        '</p>' +
        '<p class="tl-hero-summary-label">尚未開始記帳</p>' +
        '<p class="tl-hero-summary-hint">出發後即可快速記錄，現在也能預先記一筆。</p>' +
        '</div>'
      );
    }

    return (
      '<div class="tl-hero-summary tl-hero-summary-archived">' +
      '<p class="tl-hero-summary-kicker">已封存</p>' +
      '<div class="tl-hero-summary-grid">' +
      renderHeroMetricCol(
        '總花費',
        escapeHtml(DATA.formatMoneyMinor(summary.totalSpendMinor, primaryCode)),
        ''
      ) +
      renderHeroMetricCol(cash.label, cash.amountHtml, cash.modifier) +
      '</div></div>'
    );
  }

  function expenseSheetTitle(ledger, isEdit) {
    var state = getLedgerTemporalState(ledger);
    if (isEdit) return '編輯花費';
    if (state === 'ended') return '補登花費';
    if (state === 'upcoming') return '預先記錄';
    return '新增花費';
  }

  function expenseSubmitLabel(ledger, isEdit) {
    if (isEdit) return '儲存變更';
    var state = getLedgerTemporalState(ledger);
    if (state === 'ended') return '馬上記帳';
    if (state === 'upcoming') return '預先記錄';
    return '新增花費';
  }

  function needsExpenseDatePicker(ledger, isEdit) {
    var state = getLedgerTemporalState(ledger);
    if (state === 'archived') return false;
    if (state === 'active' && !isEdit) return false;
    if (state === 'active' && isEdit) return false;
    return true;
  }

  function addExpenseButtonHtml(ledgerId, ledger, today) {
    ledger = ledger || (ledgerId ? DATA.getTravelLedgerById(ledgerId) : null);
    today = today || todayDateOnly();
    var state = ledger ? getLedgerTemporalState(ledger, today) : 'active';
    if (state === 'archived') {
      return '<p class="tl-detail-note tl-archived-expense-note">解除封存後才能補登花費</p>';
    }
    var label = '＋ 新增花費';
    if (state === 'ended') label = '＋ 馬上記帳';
    if (state === 'upcoming') label = '＋ 預先記錄';
    return (
      '<button type="button" class="tl-add-expense-btn" data-tl-action="add-expense" data-ledger-id="' +
      escapeHtml(ledgerId || '') +
      '">' +
      escapeHtml(label) +
      '</button>'
    );
  }

  function getLedgerDisplayStatusLabel(statusKey) {
    var map = {
      active: '旅行中',
      upcoming: '即將出發',
      ended: '已結束',
      archived: '已封存'
    };
    return map[statusKey] || statusKey;
  }

  function getLedgerDayProgress(ledger, today) {
    today = today || todayDateOnly();
    var status = getLedgerDisplayStatus(ledger, today);
    var totalDays = daysBetweenInclusive(ledger.startDate, ledger.endDate);
    if (status === 'archived') return '已封存';
    if (status === 'upcoming') {
      var until = daysUntilStart(ledger.startDate, today);
      if (until == null) return '即將出發';
      if (until <= 0) return '今天出發';
      return '距離出發還有 ' + until + ' 天';
    }
    if (status === 'ended') {
      return totalDays > 0 ? '這趟旅行共 ' + totalDays + ' 天' : '已結束';
    }
    if (status === 'active') {
      var elapsed = daysBetweenInclusive(ledger.startDate, today);
      if (elapsed <= 0) return '今天出發';
      if (totalDays > 0 && elapsed >= totalDays) return '今天是旅行最後一天';
      if (totalDays > 0) return '今天是旅行第 ' + elapsed + ' 天';
      return '旅行進行中';
    }
    return '';
  }

  function getLedgerDayShort(ledger, today) {
    today = today || todayDateOnly();
    var status = getLedgerDisplayStatus(ledger, today);
    var totalDays = daysBetweenInclusive(ledger.startDate, ledger.endDate);
    if (status === 'active') {
      var elapsed = daysBetweenInclusive(ledger.startDate, today);
      if (totalDays > 0) return 'Day ' + elapsed + ' / ' + totalDays;
      return '旅行中';
    }
    return getLedgerDayProgress(ledger, today);
  }

  function minorToMajorInputValue(minor, currencyCode) {
    if (minor == null || minor === '') return '';
    var digits = CONFIG.getMinorUnitDigits(currencyCode);
    var factor = Math.pow(10, digits);
    var major = Number(minor) / factor;
    if (!isFinite(major)) return '';
    if (digits === 0) return String(Math.round(major));
    return major.toFixed(digits);
  }

  function sortLedgers(ledgers, today) {
    today = today || todayDateOnly();
    return (ledgers || []).slice().sort(function (a, b) {
      var sa = getLedgerDisplayStatus(a, today);
      var sb = getLedgerDisplayStatus(b, today);
      var oa = STATUS_SORT_ORDER[sa] != null ? STATUS_SORT_ORDER[sa] : 9;
      var ob = STATUS_SORT_ORDER[sb] != null ? STATUS_SORT_ORDER[sb] : 9;
      if (oa !== ob) return oa - ob;
      var da = a.startDate || '';
      var db = b.startDate || '';
      if (da !== db) return compareDateOnly(db, da);
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  function findActiveLedger(ledgers, today) {
    today = today || todayDateOnly();
    for (var i = 0; i < (ledgers || []).length; i++) {
      if (getLedgerDisplayStatus(ledgers[i], today) === 'active') return ledgers[i];
    }
    return null;
  }

  function isStorageAvailable() {
    if (typeof localStorage === 'undefined') return false;
    try {
      var key = '__soarvibe_tl_test__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getLastExpensePayment() {
    try {
      var stored = localStorage.getItem(LAST_EXPENSE_PAYMENT_KEY);
      if (stored && CONFIG.isValidPaymentMethod(stored)) return stored;
    } catch (e) {}
    return 'cash';
  }

  function saveLastExpensePayment(method) {
    if (!CONFIG.isValidPaymentMethod(method)) return;
    try {
      localStorage.setItem(LAST_EXPENSE_PAYMENT_KEY, method);
    } catch (e) {}
  }

  function formatExpenseTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function lockActiveViewScroll() {
    var view = document.querySelector('#travelLedger .tl-view:not(.hidden)');
    if (!view) return;
    tlState.expenseSheetScrollTop = view.scrollTop;
    view.style.overflow = 'hidden';
    tlState.expenseSheetLockedView = view;
  }

  function unlockActiveViewScroll() {
    var view = tlState.expenseSheetLockedView;
    if (!view) return;
    view.style.overflow = '';
    view.scrollTop = tlState.expenseSheetScrollTop || 0;
    tlState.expenseSheetLockedView = null;
  }

  function bindExpenseSheetDismissGestures(sheet) {
    if (!sheet || sheet._tlDismissBound) return;
    sheet._tlDismissBound = true;
    var panel = sheet.querySelector('.tl-expense-sheet-panel');
    var handle = sheet.querySelector('.tl-expense-sheet-handle');
    var body = sheet.querySelector('.tl-expense-sheet-body');
    if (!panel) return;

    function lockHorizontal() {
      if (body) body.scrollLeft = 0;
      panel.scrollLeft = 0;
    }

    lockHorizontal();

    var startX = 0;
    var startY = 0;
    var tracking = false;
    var fromHandle = false;

    function onTouchStart(e, isHandle) {
      if (!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      fromHandle = !!isHandle;
      tracking = true;
      lockHorizontal();
    }

    if (handle) {
      handle.addEventListener(
        'touchstart',
        function (e) {
          onTouchStart(e, true);
        },
        { passive: true }
      );
    }

    panel.addEventListener(
      'touchstart',
      function (e) {
        if (handle && e.target && (e.target === handle || handle.contains(e.target))) return;
        onTouchStart(e, false);
      },
      { passive: true }
    );

    panel.addEventListener(
      'touchmove',
      function (e) {
        if (!tracking || !e.touches || !e.touches[0]) return;
        var dx = e.touches[0].clientX - startX;
        var dy = e.touches[0].clientY - startY;
        lockHorizontal();
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (!fromHandle) return;
        if (dy > 72) {
          tracking = false;
          closeExpenseSheet();
        }
      },
      { passive: false }
    );

    panel.addEventListener(
      'touchend',
      function () {
        tracking = false;
        fromHandle = false;
        lockHorizontal();
      },
      { passive: true }
    );
  }

  function moneyInputErrorMessage(code, errorKey) {
    var digits = CONFIG.getMinorUnitDigits(code);
    if (errorKey === 'empty') return '請輸入金額';
    if (errorKey === 'zero') return '金額必須大於 0';
    if (errorKey === 'integer_only') return '此幣別不接受小數';
    if (errorKey === 'too_many_decimals') {
      return digits === 2 ? '最多接受兩位小數' : '小數位數超出限制';
    }
    if (errorKey === 'unsafe_integer') return '金額超出可接受範圍';
    return '請輸入有效金額';
  }

  function showToast(message) {
    var el = $('travelLedgerToast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add('hidden');
    }, 2600);
  }

  function showComingSoon() {
    showToast('新增花費即將開放，敬請期待');
  }

  function comingSoonButtonHtml() {
    return addExpenseButtonHtml(tlState.ledgerId || '', null);
  }

  function showConfirm(title, copy) {
    return new Promise(function (resolve) {
      var shell = $('travelLedgerConfirm');
      var titleEl = $('travelLedgerConfirmTitle');
      var copyEl = $('travelLedgerConfirmCopy');
      var okBtn = $('travelLedgerConfirmOk');
      var cancelBtn = $('travelLedgerConfirmCancel');
      if (!shell || !okBtn || !cancelBtn) {
        resolve(false);
        return;
      }
      if (titleEl) titleEl.textContent = title;
      if (copyEl) copyEl.textContent = copy;
      shell.classList.remove('hidden');

      function cleanup(result) {
        shell.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk() {
        cleanup(true);
      }
      function onCancel() {
        cleanup(false);
      }
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  function setActiveView(viewName) {
    var map = {
      list: 'travelLedgerListView',
      create: 'travelLedgerCreateView',
      edit: 'travelLedgerEditView',
      detail: 'travelLedgerDetailView'
    };
    Object.keys(map).forEach(function (key) {
      var el = $(map[key]);
      if (el) el.classList.toggle('hidden', key !== viewName);
    });
    tlState.view = viewName;
    updateHeader();
  }

  function updateHeader() {
    var backBtn = $('travelLedgerBackBtn');
    var titleEl = $('travelLedgerTitle');
    var subtitleEl = $('travelLedgerSubtitle');
    if (!titleEl || !subtitleEl) return;

    if (tlState.view === 'list' || tlState.view === 'closed') {
      if (backBtn) backBtn.classList.add('is-hidden');
      titleEl.textContent = '旅行帳本';
      subtitleEl.textContent = '每趟旅行，都有一本自己的花費紀錄';
      return;
    }
    if (backBtn) backBtn.classList.remove('is-hidden');
    if (tlState.view === 'create') {
      var step = CREATE_STEPS[tlState.createStep] || CREATE_STEPS[0];
      titleEl.textContent = '建立旅行帳本';
      subtitleEl.textContent = 'Step ' + (tlState.createStep + 1) + ' · ' + step.title;
    } else if (tlState.view === 'edit') {
      titleEl.textContent = '編輯旅行帳本';
      subtitleEl.textContent = '更新名稱、日期與預算設定';
    } else if (tlState.view === 'detail') {
      var ledger = tlState.ledgerId ? DATA.getTravelLedgerById(tlState.ledgerId) : null;
      titleEl.textContent = ledger ? ledger.name : '帳本詳情';
      subtitleEl.textContent = ledger
        ? getLedgerDayProgress(ledger)
        : '查看這趟旅行的花費摘要';
    }
  }

  function lockPageScroll() {
    var phoneScroll = document.querySelector('.phone-scroll');
    if (phoneScroll) {
      tlState.phoneScrollTop = phoneScroll.scrollTop;
      phoneScroll.style.overflow = 'hidden';
    }
  }

  function unlockPageScroll() {
    var phoneScroll = document.querySelector('.phone-scroll');
    if (phoneScroll) {
      phoneScroll.style.overflow = '';
      phoneScroll.scrollTop = tlState.phoneScrollTop || 0;
    }
  }

  function renderCurrencyOptions(selectedCode) {
    return Object.keys(CONFIG.CURRENCIES)
      .map(function (code) {
        var meta = CONFIG.CURRENCIES[code];
        return (
          '<option value="' +
          escapeHtml(code) +
          '"' +
          (code === selectedCode ? ' selected' : '') +
          '>' +
          escapeHtml(code + ' · ' + meta.name) +
          '</option>'
        );
      })
      .join('');
  }

  function getCountryProfileByCode(code) {
    return CONFIG.getCountryProfile(code);
  }

  function buildFormValues(ledger) {
    ledger = ledger || {};
    var primaryCode =
      (ledger.primaryCurrency && ledger.primaryCurrency.code) || CONFIG.COUNTRY_PROFILES[0].currencyCode;
    var displayCode =
      (ledger.displayCurrency && ledger.displayCurrency.code) || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE;
    return {
      name: ledger.name || '',
      countryCode: ledger.countryCode || 'JP',
      cityName: ledger.cityName || '',
      emoji: ledger.emoji || '🇯🇵',
      startDate: ledger.startDate || '',
      endDate: ledger.endDate || '',
      primaryCurrencyCode: primaryCode,
      displayCurrencyCode: displayCode,
      budget: minorToMajorInputValue(ledger.budgetMinor, primaryCode),
      initialCash: minorToMajorInputValue(ledger.initialCashMinor, primaryCode),
      manualExchangeRate:
        ledger.manualExchangeRate != null && isFinite(ledger.manualExchangeRate)
          ? String(ledger.manualExchangeRate)
          : ''
    };
  }

  function defaultCreateDraft() {
    return buildFormValues();
  }

  function readFormValues(form) {
    if (!form) return {};
    return {
      name: form.querySelector('[name="name"]') ? form.querySelector('[name="name"]').value.trim() : '',
      countryCode: form.querySelector('[name="countryCode"]') ? form.querySelector('[name="countryCode"]').value : '',
      cityName: form.querySelector('[name="cityName"]') ? form.querySelector('[name="cityName"]').value.trim() : '',
      emoji: form.querySelector('[name="emoji"]') ? form.querySelector('[name="emoji"]').value.trim() : '',
      startDate: form.querySelector('[name="startDate"]') ? form.querySelector('[name="startDate"]').value : '',
      endDate: form.querySelector('[name="endDate"]') ? form.querySelector('[name="endDate"]').value : '',
      primaryCurrencyCode: form.querySelector('[name="primaryCurrencyCode"]')
        ? form.querySelector('[name="primaryCurrencyCode"]').value
        : '',
      displayCurrencyCode: form.querySelector('[name="displayCurrencyCode"]')
        ? form.querySelector('[name="displayCurrencyCode"]').value
        : '',
      budget: form.querySelector('[name="budget"]') ? form.querySelector('[name="budget"]').value.trim() : '',
      initialCash: form.querySelector('[name="initialCash"]')
        ? form.querySelector('[name="initialCash"]').value.trim()
        : '',
      manualExchangeRate: form.querySelector('[name="manualExchangeRate"]')
        ? form.querySelector('[name="manualExchangeRate"]').value.trim()
        : ''
    };
  }

  function clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('.tl-field-error').forEach(function (el) {
      el.textContent = '';
    });
  }

  function setFieldError(form, fieldName, message) {
    var el = form.querySelector('[data-error-for="' + fieldName + '"]');
    if (el) el.textContent = message || '';
  }

  function validateFormValues(values, options) {
    options = options || {};
    var errors = {};
    var fields = options.fields || null;

    function need(field) {
      return !fields || fields.indexOf(field) >= 0;
    }

    if (need('name') && !values.name) errors.name = '請輸入旅行名稱';
    if (need('countryCode') && !values.countryCode) errors.countryCode = '請選擇國家／地區';
    if (need('startDate') && !values.startDate) errors.startDate = '請選擇開始日期';
    if (need('endDate') && !values.endDate) errors.endDate = '請選擇結束日期';
    if (
      need('endDate') &&
      values.startDate &&
      values.endDate &&
      compareDateOnly(values.startDate, values.endDate) > 0
    ) {
      errors.endDate = '結束日期不可早於開始日期';
    }
    if (need('primaryCurrencyCode') && !CONFIG.isValidCurrencyCode(values.primaryCurrencyCode)) {
      errors.primaryCurrencyCode = '請選擇有效的主要幣別';
    }
    if (need('displayCurrencyCode') && !CONFIG.isValidCurrencyCode(values.displayCurrencyCode)) {
      errors.displayCurrencyCode = '請選擇有效的顯示幣別';
    }
    if (need('budget') && values.budget) {
      var budgetMinor = DATA.parseMoneyToMinor(values.budget, values.primaryCurrencyCode);
      if (budgetMinor == null) errors.budget = '請輸入有效的預算金額';
      else if (budgetMinor < 0) errors.budget = '預算不可為負數';
    }
    if (need('initialCash') && values.initialCash) {
      var cashMinor = DATA.parseMoneyToMinor(values.initialCash, values.primaryCurrencyCode);
      if (cashMinor == null) errors.initialCash = '請輸入有效的現金金額';
      else if (cashMinor < 0) errors.initialCash = '現金不可為負數';
    }
    if (need('manualExchangeRate') && values.manualExchangeRate) {
      var rate = Number(values.manualExchangeRate);
      if (!isFinite(rate) || rate <= 0) errors.manualExchangeRate = '請輸入有效的匯率';
    }
    return errors;
  }

  function buildFormHtml(formId, values, options) {
    options = options || {};
    values = values || buildFormValues();
    var profile = getCountryProfileByCode(values.countryCode);
    if (!values.emoji && profile) values.emoji = profile.emoji;
    var warningHtml = options.showCurrencyWarning
      ? '<div class="tl-warning-box">這本帳本已有花費紀錄。變更主要幣別不會自動轉換既有紀錄。</div>'
      : '';

    return (
      '<form id="' +
      escapeHtml(formId) +
      '" class="tl-form-card" novalidate>' +
      warningHtml +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-name">旅行名稱</label><input class="tl-input" id="' +
      formId +
      '-name" name="name" type="text" maxlength="80" placeholder="例：東京自由行" value="' +
      escapeHtml(values.name) +
      '"><p class="tl-field-error" data-error-for="name"></p></div>' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-country">國家／地區</label><select class="tl-select" id="' +
      formId +
      '-country" name="countryCode">' +
      CONFIG.COUNTRY_PROFILES.map(function (profileItem) {
        return (
          '<option value="' +
          escapeHtml(profileItem.countryCode) +
          '"' +
          (profileItem.countryCode === values.countryCode ? ' selected' : '') +
          '>' +
          escapeHtml(profileItem.emoji + ' ' + profileItem.countryName) +
          '</option>'
        );
      }).join('') +
      '</select><p class="tl-field-error" data-error-for="countryCode"></p></div>' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-city">城市名稱 <span class="tl-optional">選填</span></label><input class="tl-input" id="' +
      formId +
      '-city" name="cityName" type="text" placeholder="例：東京" value="' +
      escapeHtml(values.cityName) +
      '"></div>' +
      '<div class="tl-form-row">' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-start">開始日期</label><input class="tl-input" id="' +
      formId +
      '-start" name="startDate" type="date" value="' +
      escapeHtml(values.startDate) +
      '"><p class="tl-field-error" data-error-for="startDate"></p></div>' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-end">結束日期</label><input class="tl-input" id="' +
      formId +
      '-end" name="endDate" type="date" value="' +
      escapeHtml(values.endDate) +
      '"><p class="tl-field-error" data-error-for="endDate"></p></div>' +
      '</div>' +
      '<div class="tl-form-row">' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-primary">主要幣別</label><select class="tl-select" id="' +
      formId +
      '-primary" name="primaryCurrencyCode">' +
      renderCurrencyOptions(values.primaryCurrencyCode) +
      '</select><p class="tl-field-error" data-error-for="primaryCurrencyCode"></p></div>' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-display">顯示幣別</label><select class="tl-select" id="' +
      formId +
      '-display" name="displayCurrencyCode">' +
      renderCurrencyOptions(values.displayCurrencyCode) +
      '</select><p class="tl-field-error" data-error-for="displayCurrencyCode"></p></div>' +
      '</div>' +
      '<div class="tl-form-row">' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-budget">旅行預算 <span class="tl-optional">選填</span></label><input class="tl-input" id="' +
      formId +
      '-budget" name="budget" inputmode="decimal" placeholder="例：100000" value="' +
      escapeHtml(values.budget) +
      '"><p class="tl-field-error" data-error-for="budget"></p></div>' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-cash">準備現金 <span class="tl-optional">選填</span></label><input class="tl-input" id="' +
      formId +
      '-cash" name="initialCash" inputmode="decimal" placeholder="例：50000" value="' +
      escapeHtml(values.initialCash) +
      '"><p class="tl-field-error" data-error-for="initialCash"></p></div>' +
      '</div>' +
      '<div class="tl-form-group"><label class="tl-form-label" for="' +
      formId +
      '-emoji">Emoji／國旗 <span class="tl-optional">選填</span></label><input class="tl-input" id="' +
      formId +
      '-emoji" name="emoji" type="text" maxlength="8" value="' +
      escapeHtml(values.emoji) +
      '"></div>' +
      (options.showManualRate
        ? '<div class="tl-form-group"><label class="tl-form-label" for="' +
          formId +
          '-rate">手動匯率 <span class="tl-optional">選填</span></label><input class="tl-input" id="' +
          formId +
          '-rate" name="manualExchangeRate" inputmode="decimal" placeholder="例：0.21" value="' +
          escapeHtml(values.manualExchangeRate) +
          '"><p class="tl-field-hint">1 單位主要幣別可換算多少顯示幣別。</p><p class="tl-field-error" data-error-for="manualExchangeRate"></p></div>'
        : '') +
      '<div class="tl-action-stack"><button type="submit" class="tl-primary-btn">' +
      escapeHtml(options.submitLabel || '儲存') +
      '</button></div></form>'
    );
  }

  function payloadFromFormValues(values) {
    var profile = getCountryProfileByCode(values.countryCode);
    var payload = {
      name: values.name,
      countryCode: values.countryCode,
      countryName: profile ? profile.countryName : values.countryCode,
      cityName: values.cityName || (profile && profile.defaultCityName) || '',
      emoji: values.emoji || (profile && profile.emoji) || '🧳',
      startDate: values.startDate,
      endDate: values.endDate,
      primaryCurrencyCode: values.primaryCurrencyCode,
      displayCurrencyCode: values.displayCurrencyCode,
      budgetMinor: values.budget ? DATA.parseMoneyToMinor(values.budget, values.primaryCurrencyCode) : null,
      initialCashMinor: values.initialCash
        ? DATA.parseMoneyToMinor(values.initialCash, values.primaryCurrencyCode)
        : null
    };
    if (values.manualExchangeRate) {
      payload.manualExchangeRate = Number(values.manualExchangeRate);
    } else if (values.manualExchangeRate === '') {
      payload.manualExchangeRate = null;
    }
    return payload;
  }

  function bindFormCountryAutoFill(form) {
    if (!form) return;
    var countrySelect = form.querySelector('[name="countryCode"]');
    var emojiInput = form.querySelector('[name="emoji"]');
    var primarySelect = form.querySelector('[name="primaryCurrencyCode"]');
    if (!countrySelect) return;
    countrySelect.addEventListener('change', function () {
      var profile = getCountryProfileByCode(countrySelect.value);
      if (!profile) return;
      if (emojiInput && (!emojiInput.value || emojiInput.dataset.autofill === '1')) {
        emojiInput.value = profile.emoji;
        emojiInput.dataset.autofill = '1';
      }
      if (primarySelect) primarySelect.value = profile.currencyCode;
    });
  }

  function renderMenu(ledger) {
    return (
      '<div class="tl-menu">' +
      '<button type="button" class="tl-menu-btn" data-tl-menu="' +
      escapeHtml(ledger.id) +
      '" aria-label="更多操作">⋯</button>' +
      '<div class="tl-menu-panel hidden" data-tl-menu-panel="' +
      escapeHtml(ledger.id) +
      '">' +
      '<button type="button" class="tl-menu-item" data-tl-action="edit" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '">編輯</button>' +
      '<button type="button" class="tl-menu-item" data-tl-action="archive" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '">' +
      (ledger.status === 'archived' ? '取消封存' : '封存') +
      '</button>' +
      '<button type="button" class="tl-menu-item is-danger" data-tl-action="delete" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '">刪除</button>' +
      '</div></div>'
    );
  }

  function renderEmptyState() {
    return (
      '<div class="tl-empty">' +
      '<div class="tl-empty-icon" aria-hidden="true">📒</div>' +
      '<h3 class="tl-empty-title">還沒有旅行帳本</h3>' +
      '<p class="tl-empty-copy">下一趟旅行，從記下第一筆花費開始。</p>' +
      '<button type="button" class="tl-primary-btn" data-tl-action="create">＋ 建立旅行帳本</button>' +
      '</div>'
    );
  }

  function renderCurrentTripCard(ledger, today) {
    var summary = DATA.calculateLedgerSummary(ledger, today);
    var primaryCode = ledger.primaryCurrency && ledger.primaryCurrency.code;
    var remainingText =
      summary.remainingBudgetMinor != null
        ? DATA.formatMoneyMinor(summary.remainingBudgetMinor, primaryCode)
        : '未設定';
    return (
      '<section class="tl-current-card ' +
      getThemeClass(ledger.countryCode) +
      '" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '" role="button" tabindex="0">' +
      '<div class="tl-current-top">' +
      '<div class="tl-current-emoji" aria-hidden="true">' +
      escapeHtml(ledger.emoji || '🧳') +
      '</div>' +
      '<div class="tl-current-heading">' +
      '<p class="tl-current-kicker">現在進行中</p>' +
      '<h2 class="tl-current-title">' +
      escapeHtml(ledger.name) +
      '</h2>' +
      '<p class="tl-current-day">' +
      escapeHtml(getLedgerDayProgress(ledger, today)) +
      '</p>' +
      '</div>' +
      '<div class="tl-pass-menu">' +
      renderMenu(ledger) +
      '</div>' +
      '</div>' +
      '<div class="tl-current-metrics">' +
      '<div class="tl-current-metric is-hero"><p class="tl-current-metric-label">今天已花</p><p class="tl-current-metric-value">' +
      escapeHtml(DATA.formatMoneyMinor(summary.todaySpendMinor, primaryCode)) +
      '</p></div>' +
      '<div class="tl-current-metric"><p class="tl-current-metric-label">剩餘預算</p><p class="tl-current-metric-value">' +
      escapeHtml(remainingText) +
      '</p></div>' +
      '<div class="tl-current-metric"><p class="tl-current-metric-label">現金剩餘</p><p class="tl-current-metric-value">' +
      escapeHtml(
        ledger.initialCashMinor == null
          ? '未設定'
          : DATA.formatMoneyMinor(summary.cashBalanceMinor, primaryCode)
      ) +
      '</p></div>' +
      '</div>' +
      addExpenseButtonHtml(ledger.id, ledger, today) +
      '</section>'
    );
  }

  function renderPassCard(ledger, today) {
    var status = getLedgerDisplayStatus(ledger, today);
    var summary = DATA.calculateLedgerSummary(ledger, today);
    var primaryCode = ledger.primaryCurrency && ledger.primaryCurrency.code;
    var remainingText =
      summary.remainingBudgetMinor != null
        ? DATA.formatMoneyMinor(summary.remainingBudgetMinor, primaryCode)
        : '未設定';
    return (
      '<article class="tl-pass ' +
      getThemeClass(ledger.countryCode) +
      '" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '" role="button" tabindex="0">' +
      '<div class="tl-pass-menu">' +
      renderMenu(ledger) +
      '</div>' +
      '<div class="tl-pass-row">' +
      '<div class="tl-pass-emoji" aria-hidden="true">' +
      escapeHtml(ledger.emoji || '🧳') +
      '</div>' +
      '<div class="tl-pass-body">' +
      '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">' +
      '<h3 class="tl-pass-title">' +
      escapeHtml(ledger.name) +
      '</h3>' +
      '<span class="tl-pass-badge">' +
      escapeHtml(getLedgerDisplayStatusLabel(status)) +
      '</span>' +
      '</div>' +
      '<p class="tl-pass-day">' +
      escapeHtml(getLedgerDayProgress(ledger, today)) +
      '</p>' +
      '</div></div>' +
      '<div class="tl-pass-figures">' +
      '<div><p class="tl-pass-figure-label">總花費</p><p class="tl-pass-figure-value">' +
      escapeHtml(DATA.formatMoneyMinor(summary.totalSpendMinor, primaryCode)) +
      '</p></div>' +
      '<div><p class="tl-pass-figure-label">剩餘預算</p><p class="tl-pass-figure-value">' +
      escapeHtml(remainingText) +
      '</p></div>' +
      '</div></article>'
    );
  }

  function renderTravelLedgerList() {
    var container = $('travelLedgerListView');
    if (!container) return;
    var today = todayDateOnly();
    var ledgers = sortLedgers(DATA.getTravelLedgers(), today);
    var html = '<div class="tl-page">';

    if (!ledgers.length) {
      html += renderEmptyState();
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    var active = findActiveLedger(ledgers, today);
    if (active) {
      html += renderCurrentTripCard(active, today);
    } else {
      html +=
        '<div class="tl-soft-empty">' +
        '<p class="tl-soft-empty-title">目前沒有進行中的旅行</p>' +
        '<p class="tl-soft-empty-copy">出發那天，這裡會變成你的今日帳本首頁。</p>' +
        '<button type="button" class="tl-primary-btn" data-tl-action="create">＋ 建立新的旅行帳本</button>' +
        '</div>';
    }

    var others = ledgers.filter(function (ledger) {
      return !active || ledger.id !== active.id;
    });

    if (others.length) {
      html += '<h3 class="tl-section-title">其他旅行</h3>';
      OTHER_GROUP_ORDER.forEach(function (statusKey) {
        var group = others.filter(function (ledger) {
          return getLedgerDisplayStatus(ledger, today) === statusKey;
        });
        if (!group.length) return;
        html += '<p class="tl-group-label">' + escapeHtml(getLedgerDisplayStatusLabel(statusKey)) + '</p>';
        group.forEach(function (ledger) {
          html += renderPassCard(ledger, today);
        });
      });
    }

    if (active) {
      html +=
        '<div class="tl-action-stack" style="margin-top:1.1rem;">' +
        '<button type="button" class="tl-secondary-btn" data-tl-action="create">＋ 建立新的旅行帳本</button>' +
        '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function yesterdayDateOnly(today) {
    var d = parseDateOnly(today || todayDateOnly());
    if (!d) return '';
    d.setDate(d.getDate() - 1);
    return formatDateOnly(d);
  }

  function expenseOccurredDate(expense) {
    return DATA.getLocalDateKeyFromIso(expense && expense.occurredAt);
  }

  function paymentIcon(method) {
    var meta = CONFIG.getPaymentMethodMeta(method);
    return (meta && meta.icon) || '💸';
  }

  function paymentLabel(method) {
    var meta = CONFIG.getPaymentMethodMeta(method);
    return (meta && meta.label) || method || '';
  }

  function sortExpensesDesc(expenses) {
    return (expenses || []).slice().sort(function (a, b) {
      return String(b.occurredAt || '').localeCompare(String(a.occurredAt || ''));
    });
  }

  function groupExpensesForDisplay(expenses, today, temporalState) {
    today = today || todayDateOnly();
    if (temporalState === 'active') {
      var yesterday = yesterdayDateOnly(today);
      var groups = { today: [], yesterday: [], earlier: [] };
      sortExpensesDesc(expenses).forEach(function (exp) {
        var key = expenseOccurredDate(exp);
        if (key === today) groups.today.push(exp);
        else if (key === yesterday) groups.yesterday.push(exp);
        else groups.earlier.push(exp);
      });
      return [
        { title: '今天', expenses: groups.today, emptyCopy: '今天還沒有花費，點上方按鈕記一筆吧。' },
        { title: '昨天', expenses: groups.yesterday, emptyCopy: '昨天沒有花費紀錄。' },
        { title: '更早', expenses: groups.earlier, emptyCopy: '', hideIfEmpty: true }
      ];
    }

    var byDate = Object.create(null);
    sortExpensesDesc(expenses).forEach(function (exp) {
      var key = expenseOccurredDate(exp) || 'unknown';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(exp);
    });
    return Object.keys(byDate)
      .sort()
      .reverse()
      .map(function (key) {
        return {
          title: key === 'unknown' ? '其他' : formatMonthDayLabel(key),
          expenses: byDate[key],
          emptyCopy: '',
          hideIfEmpty: false
        };
      });
  }

  function closeAllExpenseSwipes(container) {
    var root = container || document.querySelector('#travelLedgerDetailView');
    if (!root) return;
    root.querySelectorAll('.tl-expense-swipe').forEach(function (el) {
      el.classList.remove('is-open');
      var track = el.querySelector('.tl-expense-track');
      if (track) {
        track.style.transition = 'transform 0.18s ease';
        track.style.transform = 'translateX(0)';
      }
    });
    tlState.swipeOpenId = null;
  }

  function isExpenseSheetOpen() {
    var sheet = $('travelLedgerExpenseSheet');
    return !!(sheet && !sheet.classList.contains('hidden'));
  }

  function closeExpenseSheet() {
    var sheet = $('travelLedgerExpenseSheet');
    if (sheet) {
      sheet.classList.add('hidden');
      sheet.setAttribute('aria-hidden', 'true');
    }
    unlockActiveViewScroll();
    tlState.expenseMode = null;
    tlState.expenseId = null;
    tlState.expenseCategory = 'food';
    tlState.expensePayment = getLastExpensePayment();
  }

  function expenseAmountCategoryClass(category) {
    var key = CONFIG.isValidCategory(category) ? category : 'other';
    return 'tl-expense-amount-cat-' + key;
  }

  function renderExpenseRow(expense, ledger) {
    var primaryCode =
      (expense && expense.currencyCode) ||
      (ledger.primaryCurrency && ledger.primaryCurrency.code);
    var rowTitle = expense.title
      ? expense.title
      : expense.categoryLabel || expense.category || '花費';
    var noteHtml = expense.note
      ? '<p class="tl-expense-row-note">' + escapeHtml(expense.note) + '</p>'
      : '';
    var timeText = formatExpenseTime(expense.occurredAt);
    var isOpen = tlState.swipeOpenId === expense.id;
    return (
      '<div class="tl-expense-swipe' +
      (isOpen ? ' is-open' : '') +
      '" data-expense-swipe="' +
      escapeHtml(expense.id) +
      '">' +
      '<div class="tl-expense-track">' +
      '<button type="button" class="tl-expense-row" data-tl-action="edit-expense" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '" data-expense-id="' +
      escapeHtml(expense.id) +
      '">' +
      '<div class="tl-expense-row-icon" aria-hidden="true">' +
      escapeHtml(expense.categoryIcon || '📦') +
      '</div>' +
      '<div class="tl-expense-row-content">' +
      '<p class="tl-expense-row-title">' +
      escapeHtml(rowTitle) +
      '</p>' +
      noteHtml +
      '<p class="tl-expense-row-meta">' +
      escapeHtml(paymentIcon(expense.paymentMethod) + ' ' + paymentLabel(expense.paymentMethod)) +
      (timeText ? ' · ' + escapeHtml(timeText) : '') +
      '</p></div>' +
      '<span class="tl-expense-row-amount ' +
      expenseAmountCategoryClass(expense.category) +
      '">' +
      escapeHtml(DATA.formatMoneyMinor(expense.amountMinor, primaryCode)) +
      '</span></button>' +
      '<button type="button" class="tl-expense-delete-reveal" data-tl-action="delete-expense" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '" data-expense-id="' +
      escapeHtml(expense.id) +
      '" aria-label="刪除花費">刪除</button></div></div>'
    );
  }

  function renderExpenseGroup(title, expenses, ledger, emptyCopy) {
    var html = '<section class="tl-expense-group"><h3 class="tl-expense-group-title">' + escapeHtml(title) + '</h3>';
    if (!expenses.length) {
      html += '<p class="tl-expense-empty">' + escapeHtml(emptyCopy) + '</p>';
    } else {
      expenses.forEach(function (exp) {
        html += renderExpenseRow(exp, ledger);
      });
    }
    html += '</section>';
    return html;
  }

  function renderExpenseLists(ledger, today) {
    var temporalState = getLedgerTemporalState(ledger, today);
    var groups = groupExpensesForDisplay(ledger.expenses || [], today, temporalState);
    var html = '<div class="tl-expense-groups">';
    groups.forEach(function (group) {
      if (group.hideIfEmpty && !group.expenses.length) return;
      html += renderExpenseGroup(group.title, group.expenses, ledger, group.emptyCopy || '');
    });
    if (!groups.length || !(ledger.expenses || []).length) {
      html += '<p class="tl-expense-empty">這趟旅行還沒有花費紀錄。</p>';
    }
    html += '</div>';
    return html;
  }

  function bindExpenseSwipeHandlers(container) {
    if (!container) return;
    var deleteWidth = 80;
    var startX = 0;
    var startY = 0;
    var activeSwipe = null;
    var activeTrack = null;
    var tracking = false;
    var locked = false;
    var currentDx = 0;
    var openThreshold = 40;

    function getDeleteWidth() {
      if (deleteWidth > 0) return deleteWidth;
      var sample = container.querySelector('.tl-expense-delete-reveal');
      deleteWidth = sample ? sample.offsetWidth : 80;
      return deleteWidth;
    }

    function setTrackOffset(track, dx, animate) {
      var width = getDeleteWidth();
      var clamped = Math.max(-width, Math.min(0, dx));
      track.style.transition = animate ? 'transform 0.18s ease' : 'none';
      track.style.transform = 'translateX(' + clamped + 'px)';
      currentDx = clamped;
    }

    function openSwipe(swipeEl) {
      closeAllExpenseSwipes(container);
      swipeEl.classList.add('is-open');
      var track = swipeEl.querySelector('.tl-expense-track');
      setTrackOffset(track, -getDeleteWidth(), true);
      tlState.swipeOpenId = swipeEl.getAttribute('data-expense-swipe');
    }

    function closeSwipe(swipeEl, animate) {
      if (!swipeEl) return;
      swipeEl.classList.remove('is-open');
      var track = swipeEl.querySelector('.tl-expense-track');
      setTrackOffset(track, 0, animate !== false);
      if (tlState.swipeOpenId === swipeEl.getAttribute('data-expense-swipe')) {
        tlState.swipeOpenId = null;
      }
    }

    container.querySelectorAll('.tl-expense-groups .tl-expense-swipe').forEach(function (swipeEl) {
      var track = swipeEl.querySelector('.tl-expense-track');
      if (!track) return;
      setTrackOffset(track, 0, false);

      track.addEventListener(
        'touchstart',
        function (e) {
          if (!e.touches || !e.touches[0]) return;
          activeSwipe = swipeEl;
          activeTrack = track;
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          tracking = true;
          locked = false;
          var open = swipeEl.classList.contains('is-open');
          currentDx = open ? -getDeleteWidth() : 0;
        },
        { passive: true }
      );

      track.addEventListener(
        'touchmove',
        function (e) {
          if (!tracking || !activeTrack || activeSwipe !== swipeEl || !e.touches || !e.touches[0]) return;
          var dx = e.touches[0].clientX - startX;
          var dy = e.touches[0].clientY - startY;
          if (!locked) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            if (Math.abs(dy) > Math.abs(dx)) {
              tracking = false;
              activeSwipe = null;
              activeTrack = null;
              return;
            }
            locked = true;
            closeAllExpenseSwipes(container);
            activeSwipe = swipeEl;
            activeTrack = track;
          }
          var base = swipeEl.classList.contains('is-open') ? -getDeleteWidth() : 0;
          setTrackOffset(track, base + dx, false);
        },
        { passive: true }
      );

      track.addEventListener(
        'touchend',
        function () {
          if (!tracking || activeSwipe !== swipeEl || !activeTrack) return;
          var width = getDeleteWidth();
          if (-currentDx > openThreshold) {
            openSwipe(swipeEl);
          } else {
            closeSwipe(swipeEl, true);
          }
          tracking = false;
          locked = false;
          activeSwipe = null;
          activeTrack = null;
        },
        { passive: true }
      );
    });

    if (!container._tlSwipeScrollBound) {
      container._tlSwipeScrollBound = true;
      container.addEventListener(
        'scroll',
        function () {
          closeAllExpenseSwipes(container);
        },
        { passive: true }
      );
    }
  }

  function renderExpenseSheetBody(ledger, expense) {
    var isEdit = !!expense;
    var today = todayDateOnly();
    var primaryCode = ledger.primaryCurrency && ledger.primaryCurrency.code;
    var symbol = CONFIG.getCurrencySymbol(primaryCode) || primaryCode || '';
    var amountValue = isEdit ? minorToMajorInputValue(expense.amountMinor, primaryCode) : '';
    var category = isEdit ? expense.category : tlState.expenseCategory;
    var payment = isEdit ? expense.paymentMethod : tlState.expensePayment;
    var note = isEdit ? expense.note || '' : '';
    var showDate = needsExpenseDatePicker(ledger, isEdit);
    var defaultDate = DATA.getDefaultExpenseDateKey(ledger, expense, today);
    tlState.expenseCategory = category || 'food';
    tlState.expensePayment = payment || 'cash';

    var catKeys = CONFIG.EXPENSE_ENTRY_CATEGORY_KEYS || [];
    var catHtml = '<div class="tl-expense-cat-grid">';
    catKeys.forEach(function (key) {
      var meta = CONFIG.getCategoryMeta(key);
      if (!meta) return;
      catHtml +=
        '<button type="button" class="tl-expense-cat-chip' +
        (key === tlState.expenseCategory ? ' is-selected' : '') +
        '" data-tl-action="pick-expense-category" data-category="' +
        escapeHtml(key) +
        '"><span class="tl-expense-cat-icon" aria-hidden="true">' +
        escapeHtml(meta.icon) +
        '</span>' +
        escapeHtml(meta.label) +
        '</button>';
    });
    catHtml += '</div>';

    var payKeys = CONFIG.EXPENSE_ENTRY_PAYMENT_KEYS || ['cash', 'credit_card', 'electronic'];
    var payHtml = '<div class="tl-expense-pay-row">';
    payKeys.forEach(function (key) {
      var meta = CONFIG.getPaymentMethodMeta(key);
      if (!meta) return;
      payHtml +=
        '<button type="button" class="tl-expense-pay-chip' +
        (key === tlState.expensePayment ? ' is-selected' : '') +
        '" data-tl-action="pick-expense-payment" data-payment="' +
        escapeHtml(key) +
        '"><span class="tl-expense-pay-icon" aria-hidden="true">' +
        escapeHtml(meta.icon || '') +
        '</span>' +
        escapeHtml(meta.label) +
        '</button>';
    });
    payHtml += '</div>';

    var introHtml =
      !isEdit && getLedgerTemporalState(ledger) === 'ended'
        ? '<p class="tl-expense-sheet-intro">哎呀，好像還有漏記？選擇旅行期間的日期，馬上補上吧。</p>'
        : '';

    var dateHtml = showDate
      ? '<section class="tl-expense-date-block">' +
        '<p class="tl-expense-date-title"><span aria-hidden="true">📅</span> 消費日期</p>' +
        '<p class="tl-expense-date-hint">請選擇這筆花費實際發生的旅行日期</p>' +
        '<input class="tl-expense-date-input" name="expenseDate" type="date" min="' +
        escapeHtml(ledger.startDate || '') +
        '" max="' +
        escapeHtml(ledger.endDate || '') +
        '" value="' +
        escapeHtml(defaultDate || '') +
        '">' +
        '</section>'
      : '';

    return (
      '<form id="tlExpenseForm" novalidate>' +
      '<h3 id="travelLedgerExpenseSheetTitle" class="tl-expense-sheet-title">' +
      escapeHtml(expenseSheetTitle(ledger, isEdit)) +
      '</h3>' +
      introHtml +
      '<div class="tl-expense-amount-wrap">' +
      '<p class="tl-expense-currency">' +
      escapeHtml(primaryCode || '') +
      '</p>' +
      '<div class="tl-expense-amount-row">' +
      '<span class="tl-expense-symbol">' +
      escapeHtml(symbol) +
      '</span>' +
      '<input id="tlExpenseAmount" class="tl-expense-amount-input" name="amount" inputmode="decimal" type="text" autocomplete="off" placeholder="0" value="' +
      escapeHtml(amountValue) +
      '"></div></div>' +
      dateHtml +
      '<p class="tl-expense-section-label">分類</p>' +
      catHtml +
      '<p class="tl-expense-section-label">付款方式</p>' +
      payHtml +
      '<p class="tl-expense-section-label">備註 <span class="tl-optional">選填</span></p>' +
      '<input class="tl-expense-note-input" name="note" type="text" maxlength="120" placeholder="例如：一蘭拉麵" value="' +
      escapeHtml(note) +
      '">' +
      '<p id="tlExpenseFormError" class="tl-expense-error"></p>' +
      '<div class="tl-expense-sheet-actions">' +
      '<button type="submit" class="tl-primary-btn">' +
      escapeHtml(expenseSubmitLabel(ledger, isEdit)) +
      '</button>' +
      (isEdit
        ? '<button type="button" class="tl-danger-btn" data-tl-action="delete-expense" data-ledger-id="' +
          escapeHtml(ledger.id) +
          '" data-expense-id="' +
          escapeHtml(expense.id) +
          '">刪除這筆花費</button>'
        : '') +
      '<button type="button" class="tl-secondary-btn" data-tl-action="close-expense-sheet">取消</button>' +
      '</div></form>'
    );
  }

  function openExpenseSheet(ledgerId, expenseId) {
    var ledger = DATA.getTravelLedgerById(ledgerId);
    if (!ledger) {
      showToast('找不到這本旅行帳本');
      return;
    }
    tlState.ledgerId = ledgerId;
    var expense = null;
    if (expenseId) {
      for (var i = 0; i < (ledger.expenses || []).length; i++) {
        if (ledger.expenses[i].id === expenseId) {
          expense = ledger.expenses[i];
          break;
        }
      }
      if (!expense) {
        showToast('找不到這筆花費');
        return;
      }
      tlState.expenseMode = 'edit';
      tlState.expenseId = expenseId;
    } else {
      tlState.expenseMode = 'create';
      tlState.expenseId = null;
      tlState.expenseCategory = 'food';
      tlState.expensePayment = getLastExpensePayment();
    }

    var body = $('travelLedgerExpenseSheetBody');
    var sheet = $('travelLedgerExpenseSheet');
    if (!body || !sheet) return;
    body.innerHTML = renderExpenseSheetBody(ledger, expense);
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    lockActiveViewScroll();
    bindExpenseSheetDismissGestures(sheet);
    var amountInput = $('tlExpenseAmount');
    if (amountInput) {
      setTimeout(function () {
        amountInput.focus();
        amountInput.select && amountInput.select();
      }, 80);
    }
  }

  function openAddExpenseSheet(ledgerId) {
    var ledger = DATA.getTravelLedgerById(ledgerId || tlState.ledgerId);
    if (ledger && getLedgerTemporalState(ledger) === 'archived') {
      showToast('請先解除封存才能補登花費');
      return;
    }
    openExpenseSheet(ledgerId || tlState.ledgerId, null);
  }

  function openEditExpenseSheet(ledgerId, expenseId) {
    openExpenseSheet(ledgerId, expenseId);
  }

  function setExpenseSheetError(message) {
    var el = $('tlExpenseFormError');
    if (el) el.textContent = message || '';
  }

  function submitExpenseForm() {
    var form = $('tlExpenseForm');
    if (!form || !tlState.ledgerId) return;
    setExpenseSheetError('');
    var ledger = DATA.getTravelLedgerById(tlState.ledgerId);
    if (!ledger) {
      showToast('找不到這本旅行帳本');
      return;
    }
    var primaryCode = ledger.primaryCurrency && ledger.primaryCurrency.code;
    var amountRaw = form.querySelector('[name="amount"]')
      ? form.querySelector('[name="amount"]').value.trim()
      : '';
    var note = form.querySelector('[name="note"]') ? form.querySelector('[name="note"]').value.trim() : '';
    var amountCheck = DATA.validateMoneyInput(amountRaw, primaryCode);
    if (!amountCheck.ok) {
      setExpenseSheetError(moneyInputErrorMessage(primaryCode, amountCheck.error));
      return;
    }
    var amountMinor = amountCheck.minor;
    if (!CONFIG.isValidCategory(tlState.expenseCategory)) {
      setExpenseSheetError('請選擇分類');
      return;
    }
    if (!CONFIG.isValidPaymentMethod(tlState.expensePayment)) {
      setExpenseSheetError('請選擇付款方式');
      return;
    }

    var temporalState = getLedgerTemporalState(ledger);
    if (temporalState === 'archived') {
      setExpenseSheetError('已封存的帳本無法新增花費');
      return;
    }

    var occurredAt = null;
    if (needsExpenseDatePicker(ledger, tlState.expenseMode === 'edit')) {
      var dateInput = form.querySelector('[name="expenseDate"]');
      var dateKey = dateInput ? dateInput.value.trim() : '';
      var dateCheck = DATA.validateExpenseDateInTrip(dateKey, ledger);
      if (!dateCheck.ok) {
        if (dateCheck.error === 'before_start') {
          setExpenseSheetError('日期不可早於旅行開始日');
        } else if (dateCheck.error === 'after_end') {
          setExpenseSheetError('日期不可晚於旅行結束日');
        } else {
          setExpenseSheetError('請選擇旅行期間內的日期');
        }
        return;
      }
      if (tlState.expenseMode === 'edit' && tlState.expenseId) {
        var existing = null;
        for (var ei = 0; ei < (ledger.expenses || []).length; ei++) {
          if (ledger.expenses[ei].id === tlState.expenseId) {
            existing = ledger.expenses[ei];
            break;
          }
        }
        occurredAt = DATA.buildOccurredAtFromDateKey(
          dateKey,
          existing && existing.occurredAt ? new Date(existing.occurredAt) : new Date()
        );
      } else {
        occurredAt = DATA.buildOccurredAtFromDateKey(dateKey, new Date());
      }
    } else if (tlState.expenseMode === 'edit' && tlState.expenseId) {
      for (var ej = 0; ej < (ledger.expenses || []).length; ej++) {
        if (ledger.expenses[ej].id === tlState.expenseId) {
          occurredAt = ledger.expenses[ej].occurredAt;
          break;
        }
      }
    } else {
      occurredAt = new Date().toISOString();
    }

    if (!isStorageAvailable()) {
      showToast('目前無法儲存資料');
      return;
    }

    var payload = {
      amountMinor: amountMinor,
      currencyCode: primaryCode,
      category: tlState.expenseCategory,
      paymentMethod: tlState.expensePayment,
      note: note
    };
    if (occurredAt) payload.occurredAt = occurredAt;

    try {
      if (tlState.expenseMode === 'edit' && tlState.expenseId) {
        var updated = DATA.updateTravelExpense(tlState.ledgerId, tlState.expenseId, payload);
        if (!updated) {
          showToast('更新失敗，請稍後再試');
          return;
        }
        showToast('花費已更新');
      } else {
        var created = DATA.addTravelExpense(tlState.ledgerId, payload);
        if (!created) {
          showToast('新增失敗，請稍後再試');
          return;
        }
        showToast('已記下一筆花費');
      }
      saveLastExpensePayment(tlState.expensePayment);
      closeExpenseSheet();
      tlState.swipeOpenId = null;
      if (tlState.view === 'detail') {
        renderDetailView(tlState.ledgerId);
      } else if (tlState.view === 'list') {
        renderTravelLedgerList();
      }
    } catch (e) {
      showToast('儲存失敗，請稍後再試');
    }
  }

  function confirmDeleteExpense(ledgerId, expenseId) {
    var ledger = DATA.getTravelLedgerById(ledgerId);
    if (!ledger) {
      showToast('找不到這本旅行帳本');
      return Promise.resolve(false);
    }
    var expense = null;
    for (var i = 0; i < (ledger.expenses || []).length; i++) {
      if (ledger.expenses[i].id === expenseId) {
        expense = ledger.expenses[i];
        break;
      }
    }
    if (!expense) {
      showToast('找不到這筆花費');
      return Promise.resolve(false);
    }
    var label = (expense.categoryLabel || '花費') + ' ' + DATA.formatMoneyMinor(expense.amountMinor, expense.currencyCode);
    return showConfirm('刪除這筆花費？', '將刪除「' + label + '」，此操作無法復原。').then(function (ok) {
      if (!ok) return false;
      if (!isStorageAvailable()) {
        showToast('目前無法儲存資料');
        return false;
      }
      var deleted = DATA.deleteTravelExpense(ledgerId, expenseId);
      if (!deleted) {
        showToast('刪除失敗，請稍後再試');
        return false;
      }
      showToast('花費已刪除');
      tlState.swipeOpenId = null;
      closeExpenseSheet();
      if (tlState.view === 'detail') {
        renderDetailView(ledgerId);
      } else if (tlState.view === 'list') {
        renderTravelLedgerList();
      }
      return true;
    });
  }

  function renderDetailView(ledgerId) {
    var container = $('travelLedgerDetailView');
    if (!container) return;
    var ledger = DATA.getTravelLedgerById(ledgerId);
    if (!ledger) {
      container.innerHTML =
        '<div class="tl-page"><div class="tl-detail-note">找不到這本旅行帳本，可能已被刪除。</div><button type="button" class="tl-secondary-btn" data-tl-action="back-list">返回帳本列表</button></div>';
      return;
    }
    var today = todayDateOnly();
    var summary = DATA.calculateLedgerSummary(ledger, today);
    var primaryCode = ledger.primaryCurrency && ledger.primaryCurrency.code;
    var temporalState = getLedgerTemporalState(ledger, today);
    var avgText =
      summary.averageDailySpendMinor != null
        ? DATA.formatMoneyMinor(summary.averageDailySpendMinor, primaryCode)
        : '—';
    var remainingRow =
      summary.budgetMinor != null
        ? summary.budgetOverMinor != null && summary.budgetOverMinor > 0
          ? '<div class="tl-summary-row"><span class="tl-summary-label is-warning">已超出預算</span><span class="tl-summary-value is-over">' +
            escapeHtml(DATA.formatMoneyMinor(summary.budgetOverMinor, primaryCode)) +
            '</span></div>'
          : '<div class="tl-summary-row"><span class="tl-summary-label">剩餘預算</span><span class="tl-summary-value">' +
            escapeHtml(DATA.formatMoneyMinor(summary.remainingBudgetMinor, primaryCode)) +
            '</span></div>'
        : '<div class="tl-detail-note">尚未設定旅行預算</div>';

    container.innerHTML =
      '<div class="tl-page">' +
      '<div class="tl-detail-hero ' +
      getThemeClass(ledger.countryCode) +
      '">' +
      '<div class="tl-detail-emoji" aria-hidden="true">' +
      escapeHtml(ledger.emoji || '🧳') +
      '</div>' +
      '<h2 class="tl-detail-title">' +
      escapeHtml(ledger.name) +
      '</h2>' +
      '<p class="tl-detail-day">' +
      escapeHtml(getLedgerDayProgress(ledger, today)) +
      '</p>' +
      '<p class="tl-detail-meta">' +
      escapeHtml(formatSlashRange(ledger.startDate, ledger.endDate)) +
      ' · ' +
      escapeHtml(primaryCode || '') +
      ' · ' +
      escapeHtml(getLedgerDisplayStatusLabel(temporalState)) +
      '</p></div>' +
      renderDetailPrimarySummary(ledger, today, summary, primaryCode) +
      addExpenseButtonHtml(ledger.id, ledger, today) +
      renderExpenseLists(ledger, today) +
      '<div class="tl-summary-card">' +
      '<h3 class="tl-summary-title">旅行摘要</h3>' +
      '<div class="tl-summary-row"><span class="tl-summary-label">總花費</span><span class="tl-summary-value">' +
      escapeHtml(DATA.formatMoneyMinor(summary.totalSpendMinor, primaryCode)) +
      '</span></div>' +
      remainingRow +
      '<div class="tl-summary-row"><span class="tl-summary-label">現金餘額</span><span class="tl-summary-value">' +
      escapeHtml(DATA.formatMoneyMinor(summary.cashBalanceMinor, primaryCode)) +
      '</span></div>' +
      '<div class="tl-summary-row"><span class="tl-summary-label">信用卡／電子支付</span><span class="tl-summary-value">' +
      escapeHtml(DATA.formatMoneyMinor(summary.nonCashSpendMinor, primaryCode)) +
      '</span></div>' +
      '<div class="tl-summary-row"><span class="tl-summary-label">平均每日</span><span class="tl-summary-value">' +
      escapeHtml(avgText) +
      '</span></div></div>' +
      '<div class="tl-placeholder-block">' +
      '<p class="tl-placeholder-title">統計</p>' +
      '<p class="tl-placeholder-copy">分類統計與旅行回顧將在 Phase 1D 開放。</p></div>' +
      '<div class="tl-action-stack">' +
      '<button type="button" class="tl-secondary-btn" data-tl-action="edit" data-ledger-id="' +
      escapeHtml(ledger.id) +
      '">編輯帳本</button>' +
      '<button type="button" class="tl-secondary-btn" data-tl-action="back-list">返回帳本列表</button>' +
      '</div></div>';

    bindExpenseSwipeHandlers(container);
  }

  function captureCreateStepValues() {
    var form = $('tlCreateForm');
    if (!form || !tlState.createDraft) return;
    var values = readFormValues(form);
    Object.keys(values).forEach(function (key) {
      if (values[key] !== '' && values[key] != null) {
        tlState.createDraft[key] = values[key];
      } else if (key === 'budget' || key === 'initialCash' || key === 'manualExchangeRate' || key === 'cityName') {
        tlState.createDraft[key] = values[key];
      }
    });
    if (!values.countryCode && form.querySelector('[name="countryCode"]')) {
      tlState.createDraft.countryCode = form.querySelector('[name="countryCode"]').value;
    }
  }

  function renderCreateStep() {
    var container = $('travelLedgerCreateView');
    if (!container) return;
    if (!tlState.createDraft) tlState.createDraft = defaultCreateDraft();
    var stepIndex = tlState.createStep;
    var step = CREATE_STEPS[stepIndex];
    var draft = tlState.createDraft;
    var progressHtml = '<div class="tl-step-progress" aria-hidden="true">';
    for (var i = 0; i < CREATE_STEPS.length; i++) {
      progressHtml +=
        '<div class="tl-step-dot' +
        (i < stepIndex ? ' is-done' : '') +
        (i === stepIndex ? ' is-current' : '') +
        '"></div>';
    }
    progressHtml += '</div>';

    var body = '';
    if (step.id === 'where') {
      body +=
        '<input type="hidden" name="countryCode" value="' +
        escapeHtml(draft.countryCode) +
        '">' +
        '<input type="hidden" name="emoji" value="' +
        escapeHtml(draft.emoji) +
        '" data-autofill="1">' +
        '<input type="hidden" name="primaryCurrencyCode" value="' +
        escapeHtml(draft.primaryCurrencyCode) +
        '">' +
        '<input type="hidden" name="displayCurrencyCode" value="' +
        escapeHtml(draft.displayCurrencyCode || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE) +
        '">' +
        '<div class="tl-country-grid">';
      CONFIG.COUNTRY_PROFILES.forEach(function (profile) {
        body +=
          '<button type="button" class="tl-country-chip' +
          (profile.countryCode === draft.countryCode ? ' is-selected' : '') +
          '" data-tl-action="pick-country" data-country="' +
          escapeHtml(profile.countryCode) +
          '"><span class="tl-country-emoji" aria-hidden="true">' +
          escapeHtml(profile.emoji) +
          '</span>' +
          escapeHtml(profile.countryName) +
          '</button>';
      });
      body +=
        '</div><p class="tl-field-error" data-error-for="countryCode"></p>' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-city">城市名稱 <span class="tl-optional">選填</span></label>' +
        '<input class="tl-input" id="tlCreateForm-city" name="cityName" type="text" placeholder="例：東京" value="' +
        escapeHtml(draft.cityName) +
        '"></div>';
    } else if (step.id === 'name') {
      body +=
        '<input type="hidden" name="countryCode" value="' +
        escapeHtml(draft.countryCode) +
        '">' +
        '<input type="hidden" name="emoji" value="' +
        escapeHtml(draft.emoji) +
        '">' +
        '<input type="hidden" name="cityName" value="' +
        escapeHtml(draft.cityName) +
        '">' +
        '<input type="hidden" name="displayCurrencyCode" value="' +
        escapeHtml(draft.displayCurrencyCode || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE) +
        '">' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-name">旅行名稱</label>' +
        '<input class="tl-input" id="tlCreateForm-name" name="name" type="text" maxlength="80" placeholder="例：東京自由行" value="' +
        escapeHtml(draft.name) +
        '" autofocus><p class="tl-field-error" data-error-for="name"></p></div>' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-primary">主要幣別</label>' +
        '<select class="tl-select" id="tlCreateForm-primary" name="primaryCurrencyCode">' +
        renderCurrencyOptions(draft.primaryCurrencyCode) +
        '</select><p class="tl-field-error" data-error-for="primaryCurrencyCode"></p></div>';
    } else if (step.id === 'dates') {
      body +=
        '<input type="hidden" name="name" value="' +
        escapeHtml(draft.name) +
        '">' +
        '<input type="hidden" name="countryCode" value="' +
        escapeHtml(draft.countryCode) +
        '">' +
        '<input type="hidden" name="emoji" value="' +
        escapeHtml(draft.emoji) +
        '">' +
        '<input type="hidden" name="cityName" value="' +
        escapeHtml(draft.cityName) +
        '">' +
        '<input type="hidden" name="primaryCurrencyCode" value="' +
        escapeHtml(draft.primaryCurrencyCode) +
        '">' +
        '<input type="hidden" name="displayCurrencyCode" value="' +
        escapeHtml(draft.displayCurrencyCode || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE) +
        '">' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-start">開始日期</label>' +
        '<input class="tl-input" id="tlCreateForm-start" name="startDate" type="date" value="' +
        escapeHtml(draft.startDate) +
        '"><p class="tl-field-error" data-error-for="startDate"></p></div>' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-end">結束日期</label>' +
        '<input class="tl-input" id="tlCreateForm-end" name="endDate" type="date" value="' +
        escapeHtml(draft.endDate) +
        '"><p class="tl-field-error" data-error-for="endDate"></p></div>';
    } else {
      body +=
        '<input type="hidden" name="name" value="' +
        escapeHtml(draft.name) +
        '">' +
        '<input type="hidden" name="countryCode" value="' +
        escapeHtml(draft.countryCode) +
        '">' +
        '<input type="hidden" name="emoji" value="' +
        escapeHtml(draft.emoji) +
        '">' +
        '<input type="hidden" name="cityName" value="' +
        escapeHtml(draft.cityName) +
        '">' +
        '<input type="hidden" name="startDate" value="' +
        escapeHtml(draft.startDate) +
        '">' +
        '<input type="hidden" name="endDate" value="' +
        escapeHtml(draft.endDate) +
        '">' +
        '<input type="hidden" name="primaryCurrencyCode" value="' +
        escapeHtml(draft.primaryCurrencyCode) +
        '">' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-budget">旅行預算 <span class="tl-optional">選填</span></label>' +
        '<input class="tl-input" id="tlCreateForm-budget" name="budget" inputmode="decimal" placeholder="例：100000" value="' +
        escapeHtml(draft.budget) +
        '"><p class="tl-field-error" data-error-for="budget"></p></div>' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-cash">準備現金 <span class="tl-optional">選填</span></label>' +
        '<input class="tl-input" id="tlCreateForm-cash" name="initialCash" inputmode="decimal" placeholder="例：50000" value="' +
        escapeHtml(draft.initialCash) +
        '"><p class="tl-field-error" data-error-for="initialCash"></p></div>' +
        '<div class="tl-form-group"><label class="tl-form-label" for="tlCreateForm-display">顯示幣別</label>' +
        '<select class="tl-select" id="tlCreateForm-display" name="displayCurrencyCode">' +
        renderCurrencyOptions(draft.displayCurrencyCode || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE) +
        '</select><p class="tl-field-error" data-error-for="displayCurrencyCode"></p></div>';
    }

    var isFirst = stepIndex === 0;
    var isLast = stepIndex === CREATE_STEPS.length - 1;
    var navClass = isFirst ? 'tl-step-nav is-first' : 'tl-step-nav';
    var navHtml =
      '<div class="' +
      navClass +
      '">' +
      (isFirst
        ? ''
        : '<button type="button" class="tl-secondary-btn" data-tl-action="create-prev">上一步</button>') +
      '<button type="submit" class="tl-primary-btn">' +
      (isLast ? '完成建立' : '下一步') +
      '</button></div>';

    container.innerHTML =
      '<div class="tl-page">' +
      progressHtml +
      '<form id="tlCreateForm" class="tl-step-card" novalidate>' +
      '<p class="tl-step-kicker">STEP ' +
      (stepIndex + 1) +
      ' / ' +
      CREATE_STEPS.length +
      '</p>' +
      '<h2 class="tl-step-title">' +
      escapeHtml(step.title) +
      '</h2>' +
      '<p class="tl-step-copy">' +
      escapeHtml(step.copy) +
      '</p>' +
      body +
      navHtml +
      '</form></div>';
    updateHeader();
  }

  function validateCreateStep() {
    var form = $('tlCreateForm');
    if (!form) return false;
    clearFormErrors(form);
    captureCreateStepValues();
    var values = Object.assign({}, tlState.createDraft, readFormValues(form));
    var step = CREATE_STEPS[tlState.createStep];
    var fields = [];
    if (step.id === 'where') fields = ['countryCode'];
    if (step.id === 'name') fields = ['name', 'primaryCurrencyCode'];
    if (step.id === 'dates') fields = ['startDate', 'endDate'];
    if (step.id === 'budget') fields = ['budget', 'initialCash', 'displayCurrencyCode'];
    var errors = validateFormValues(values, { fields: fields });
    Object.keys(errors).forEach(function (key) {
      setFieldError(form, key, errors[key]);
    });
    return Object.keys(errors).length === 0;
  }

  function openCreateTravelLedger() {
    tlState.createStep = 0;
    tlState.createDraft = defaultCreateDraft();
    renderCreateStep();
    setActiveView('create');
    var viewport = $('travelLedgerViewport');
    if (viewport) viewport.scrollTop = 0;
  }

  function openEditTravelLedger(ledgerId) {
    var ledger = DATA.getTravelLedgerById(ledgerId);
    if (!ledger) {
      showToast('找不到這本旅行帳本');
      return;
    }
    tlState.editId = ledgerId;
    var container = $('travelLedgerEditView');
    if (!container) return;
    container.innerHTML =
      '<div class="tl-page">' +
      buildFormHtml('tlEditForm', buildFormValues(ledger), {
        submitLabel: '儲存變更',
        showManualRate: true,
        showCurrencyWarning: (ledger.expenses || []).length > 0
      }) +
      '</div>';
    var form = $('tlEditForm');
    if (form) form.dataset.originalPrimary = ledger.primaryCurrency && ledger.primaryCurrency.code;
    bindFormCountryAutoFill(form);
    setActiveView('edit');
    var viewport = $('travelLedgerViewport');
    if (viewport) viewport.scrollTop = 0;
  }

  function openTravelLedgerDetail(ledgerId) {
    tlState.ledgerId = ledgerId;
    renderDetailView(ledgerId);
    setActiveView('detail');
    var viewport = $('travelLedgerViewport');
    if (viewport) viewport.scrollTop = 0;
  }

  function submitCreateTravelLedger() {
    if (!validateCreateStep()) return;
    captureCreateStepValues();

    if (tlState.createStep < CREATE_STEPS.length - 1) {
      tlState.createStep += 1;
      renderCreateStep();
      var viewport = $('travelLedgerViewport');
      if (viewport) viewport.scrollTop = 0;
      return;
    }

    var values = tlState.createDraft;
    var errors = validateFormValues(values);
    if (Object.keys(errors).length) {
      showToast('請檢查尚未完成的欄位');
      return;
    }
    if (!isStorageAvailable()) {
      showToast('目前無法儲存資料，請確認瀏覽器允許本地儲存');
      return;
    }
    try {
      var ledger = DATA.createTravelLedger(payloadFromFormValues(values));
      showToast('旅行帳本已建立');
      tlState.createDraft = null;
      tlState.createStep = 0;
      openTravelLedgerDetail(ledger.id);
    } catch (e) {
      showToast('建立失敗，請稍後再試');
    }
  }

  function submitEditTravelLedger() {
    var form = $('tlEditForm');
    if (!form || !tlState.editId) return;
    clearFormErrors(form);
    var values = readFormValues(form);
    var errors = validateFormValues(values);
    Object.keys(errors).forEach(function (key) {
      setFieldError(form, key, errors[key]);
    });
    if (Object.keys(errors).length) return;
    if (!isStorageAvailable()) {
      showToast('目前無法儲存資料，請確認瀏覽器允許本地儲存');
      return;
    }
    try {
      var updated = DATA.updateTravelLedger(tlState.editId, payloadFromFormValues(values));
      if (!updated) {
        showToast('找不到這本旅行帳本');
        renderTravelLedgerList();
        setActiveView('list');
        return;
      }
      showToast('旅行帳本已更新');
      openTravelLedgerDetail(updated.id);
    } catch (e) {
      showToast('更新失敗，請稍後再試');
    }
  }

  function confirmDeleteTravelLedger(ledgerId) {
    var ledger = DATA.getTravelLedgerById(ledgerId);
    if (!ledger) {
      showToast('找不到這本旅行帳本');
      return Promise.resolve(false);
    }
    return showConfirm(
      '刪除這本旅行帳本？',
      '「' + ledger.name + '」的所有資料將一併刪除，此操作無法復原。'
    ).then(function (ok) {
      if (!ok) return false;
      if (!isStorageAvailable()) {
        showToast('目前無法儲存資料');
        return false;
      }
      var deleted = DATA.deleteTravelLedger(ledgerId);
      if (!deleted) {
        showToast('刪除失敗，請稍後再試');
        return false;
      }
      showToast('旅行帳本已刪除');
      if (tlState.ledgerId === ledgerId) tlState.ledgerId = null;
      renderTravelLedgerList();
      setActiveView('list');
      return true;
    });
  }

  function archiveTravelLedgerFromUI(ledgerId) {
    var ledger = DATA.getTravelLedgerById(ledgerId);
    if (!ledger) {
      showToast('找不到這本旅行帳本');
      return;
    }
    if (!isStorageAvailable()) {
      showToast('目前無法儲存資料');
      return;
    }
    try {
      if (ledger.status === 'archived') {
        var tempLedger = Object.assign({}, ledger, { status: 'upcoming' });
        DATA.updateTravelLedger(ledgerId, { status: DATA.deriveLedgerStatus(tempLedger) });
        showToast('已取消封存');
      } else {
        DATA.archiveTravelLedger(ledgerId);
        showToast('旅行帳本已封存');
      }
      renderTravelLedgerList();
      if (tlState.view === 'detail' && tlState.ledgerId === ledgerId) {
        renderDetailView(ledgerId);
      }
    } catch (e) {
      showToast('操作失敗，請稍後再試');
    }
  }

  function closeAllMenus() {
    document.querySelectorAll('#travelLedger .tl-menu-panel').forEach(function (panel) {
      panel.classList.add('hidden');
    });
    tlState.openMenuId = null;
  }

  function syncExpenseChipSelection() {
    var body = $('travelLedgerExpenseSheetBody');
    if (!body) return;
    body.querySelectorAll('.tl-expense-cat-chip').forEach(function (chip) {
      chip.classList.toggle(
        'is-selected',
        chip.getAttribute('data-category') === tlState.expenseCategory
      );
    });
    body.querySelectorAll('.tl-expense-pay-chip').forEach(function (chip) {
      chip.classList.toggle(
        'is-selected',
        chip.getAttribute('data-payment') === tlState.expensePayment
      );
    });
  }

  function handleBack() {
    if (isExpenseSheetOpen()) {
      closeExpenseSheet();
      return;
    }
    if (tlState.view === 'list' || tlState.view === 'closed') {
      closeTravelLedger();
      return;
    }
    if (tlState.view === 'create' && tlState.createStep > 0) {
      captureCreateStepValues();
      tlState.createStep -= 1;
      renderCreateStep();
      return;
    }
    renderTravelLedgerList();
    setActiveView('list');
  }

  function openTravelLedger() {
    var shell = $('travelLedger');
    if (!shell) return;
    if (!isStorageAvailable()) {
      showToast('本地儲存不可用，旅行帳本可能無法保存');
    }
    renderTravelLedgerList();
    setActiveView('list');
    shell.classList.remove('hidden');
    shell.setAttribute('aria-hidden', 'false');
    lockPageScroll();
    var viewport = $('travelLedgerViewport');
    if (viewport) viewport.scrollTop = 0;
  }

  function closeTravelLedger() {
    var shell = $('travelLedger');
    if (!shell) return;
    closeExpenseSheet();
    unlockActiveViewScroll();
    shell.classList.add('hidden');
    shell.setAttribute('aria-hidden', 'true');
    unlockPageScroll();
    closeAllMenus();
    tlState.view = 'closed';
    tlState.ledgerId = null;
    tlState.editId = null;
    tlState.createStep = 0;
    tlState.createDraft = null;
    tlState.swipeOpenId = null;
  }

  function openWithFixture() {
    return fetch('./scripts/fixtures/travel-ledger-seed.json')
      .then(function (res) {
        if (!res.ok) throw new Error('fixture_load_failed');
        return res.json();
      })
      .then(function (data) {
        DATA.importTravelLedgerStore(data);
        openTravelLedger();
      })
      .catch(function () {
        showToast('無法載入測試 fixture');
      });
  }

  function handleShellClick(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var shell = $('travelLedger');
    if (!shell || shell.classList.contains('hidden')) return;

    if (!target.closest('.tl-menu')) closeAllMenus();

    if (
      !target.closest('.tl-expense-swipe') &&
      !target.closest('[data-tl-action="delete-expense"]')
    ) {
      closeAllExpenseSwipes($('travelLedgerDetailView'));
    }

    var actionEl = target.closest('[data-tl-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-tl-action');
      var ledgerId = actionEl.getAttribute('data-ledger-id');
      if (action === 'create') {
        e.preventDefault();
        openCreateTravelLedger();
        return;
      }
      if (action === 'create-prev') {
        e.preventDefault();
        captureCreateStepValues();
        if (tlState.createStep > 0) {
          tlState.createStep -= 1;
          renderCreateStep();
        }
        return;
      }
      if (action === 'pick-country') {
        e.preventDefault();
        var code = actionEl.getAttribute('data-country');
        var profile = getCountryProfileByCode(code);
        if (!profile || !tlState.createDraft) return;
        tlState.createDraft.countryCode = profile.countryCode;
        tlState.createDraft.emoji = profile.emoji;
        tlState.createDraft.primaryCurrencyCode = profile.currencyCode;
        if (!tlState.createDraft.cityName) {
          tlState.createDraft.cityName = profile.defaultCityName || '';
        }
        renderCreateStep();
        return;
      }
      if (action === 'add-expense' && ledgerId) {
        e.preventDefault();
        e.stopPropagation();
        openAddExpenseSheet(ledgerId);
        return;
      }
      if (action === 'close-expense-sheet') {
        e.preventDefault();
        closeExpenseSheet();
        return;
      }
      if (action === 'pick-expense-category') {
        e.preventDefault();
        tlState.expenseCategory = actionEl.getAttribute('data-category') || 'food';
        syncExpenseChipSelection();
        return;
      }
      if (action === 'pick-expense-payment') {
        e.preventDefault();
        tlState.expensePayment = actionEl.getAttribute('data-payment') || 'cash';
        syncExpenseChipSelection();
        return;
      }
      if (action === 'edit-expense' && ledgerId) {
        e.preventDefault();
        e.stopPropagation();
        openEditExpenseSheet(ledgerId, actionEl.getAttribute('data-expense-id'));
        return;
      }
      if (action === 'delete-expense' && ledgerId) {
        e.preventDefault();
        e.stopPropagation();
        confirmDeleteExpense(ledgerId, actionEl.getAttribute('data-expense-id'));
        return;
      }
      if (action === 'coming-soon') {
        e.preventDefault();
        e.stopPropagation();
        showComingSoon();
        return;
      }
      if (action === 'edit' && ledgerId) {
        e.preventDefault();
        openEditTravelLedger(ledgerId);
        return;
      }
      if (action === 'archive' && ledgerId) {
        e.preventDefault();
        archiveTravelLedgerFromUI(ledgerId);
        return;
      }
      if (action === 'delete' && ledgerId) {
        e.preventDefault();
        confirmDeleteTravelLedger(ledgerId);
        return;
      }
      if (action === 'back-list') {
        e.preventDefault();
        renderTravelLedgerList();
        setActiveView('list');
        return;
      }
    }

    var menuBtn = target.closest('[data-tl-menu]');
    if (menuBtn) {
      e.preventDefault();
      e.stopPropagation();
      var menuId = menuBtn.getAttribute('data-tl-menu');
      var panel = shell.querySelector('[data-tl-menu-panel="' + menuId + '"]');
      if (!panel) return;
      var willOpen = panel.classList.contains('hidden');
      closeAllMenus();
      if (willOpen) {
        panel.classList.remove('hidden');
        tlState.openMenuId = menuId;
      }
      return;
    }

    var card = target.closest('[data-ledger-id][role="button"]');
    if (card && !target.closest('.tl-menu') && !target.closest('[data-tl-action="add-expense"]') && !target.closest('[data-tl-action="coming-soon"]')) {
      e.preventDefault();
      openTravelLedgerDetail(card.getAttribute('data-ledger-id'));
    }
  }

  function handleFormSubmit(e) {
    var form = e.target;
    if (!form || !form.id) return;
    if (form.id === 'tlCreateForm') {
      e.preventDefault();
      submitCreateTravelLedger();
      return;
    }
    if (form.id === 'tlEditForm') {
      e.preventDefault();
      submitEditTravelLedger();
      return;
    }
    if (form.id === 'tlExpenseForm') {
      e.preventDefault();
      submitExpenseForm();
    }
  }

  function initTravelLedgerUi() {
    var shell = $('travelLedger');
    if (!shell) return;

    shell.addEventListener('click', handleShellClick);
    shell.addEventListener('submit', handleFormSubmit);

    var backBtn = $('travelLedgerBackBtn');
    var closeBtn = $('travelLedgerCloseBtn');
    if (backBtn) backBtn.addEventListener('click', handleBack);
    if (closeBtn) closeBtn.addEventListener('click', closeTravelLedger);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || shell.classList.contains('hidden')) return;
      if (!$('travelLedgerConfirm') || !$('travelLedgerConfirm').classList.contains('hidden')) return;
      if (isExpenseSheetOpen()) {
        closeExpenseSheet();
        return;
      }
      handleBack();
    });
  }

  var api = {
    openTravelLedger: openTravelLedger,
    closeTravelLedger: closeTravelLedger,
    renderTravelLedgerList: renderTravelLedgerList,
    openCreateTravelLedger: openCreateTravelLedger,
    openEditTravelLedger: openEditTravelLedger,
    openTravelLedgerDetail: openTravelLedgerDetail,
    submitCreateTravelLedger: submitCreateTravelLedger,
    submitEditTravelLedger: submitEditTravelLedger,
    confirmDeleteTravelLedger: confirmDeleteTravelLedger,
    archiveTravelLedgerFromUI: archiveTravelLedgerFromUI,
    openAddExpenseSheet: openAddExpenseSheet,
    openEditExpenseSheet: openEditExpenseSheet,
    submitExpenseForm: submitExpenseForm,
    confirmDeleteExpense: confirmDeleteExpense,
    closeExpenseSheet: closeExpenseSheet,
    getLedgerDisplayStatus: getLedgerDisplayStatus,
    getLedgerTemporalState: getLedgerTemporalState,
    groupExpensesForDisplay: groupExpensesForDisplay,
    formatMonthDayLabel: formatMonthDayLabel,
    formatRemainingBudgetHero: formatRemainingBudgetHero,
    formatCashHero: formatCashHero,
    needsExpenseDatePicker: needsExpenseDatePicker,
    closeAllExpenseSwipes: closeAllExpenseSwipes,
    renderDetailPrimarySummary: renderDetailPrimarySummary,
    renderExpenseSheetBody: renderExpenseSheetBody,
    expenseSheetTitle: expenseSheetTitle,
    expenseSubmitLabel: expenseSubmitLabel,
    addExpenseButtonHtml: addExpenseButtonHtml,
    getLedgerDayProgress: getLedgerDayProgress,
    getLedgerDayShort: getLedgerDayShort,
    openWithFixture: openWithFixture
  };

  global.SOARVIBE_TRAVEL_LEDGER_UI = api;
  global.openTravelLedger = openTravelLedger;
  global.closeTravelLedger = closeTravelLedger;
  global.renderTravelLedgerList = renderTravelLedgerList;
  global.openCreateTravelLedger = openCreateTravelLedger;
  global.openEditTravelLedger = openEditTravelLedger;
  global.openTravelLedgerDetail = openTravelLedgerDetail;
  global.submitCreateTravelLedger = submitCreateTravelLedger;
  global.submitEditTravelLedger = submitEditTravelLedger;
  global.confirmDeleteTravelLedger = confirmDeleteTravelLedger;
  global.archiveTravelLedgerFromUI = archiveTravelLedgerFromUI;
  global.openAddExpenseSheet = openAddExpenseSheet;
  global.openEditExpenseSheet = openEditExpenseSheet;
  global.submitExpenseForm = submitExpenseForm;
  global.confirmDeleteExpense = confirmDeleteExpense;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTravelLedgerUi);
  } else {
    initTravelLedgerUi();
  }
})(typeof window !== 'undefined' ? window : globalThis);
