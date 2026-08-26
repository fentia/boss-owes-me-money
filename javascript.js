const $ = id => document.getElementById(id);
const fmt = (n, d = 2) => n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
const daysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };

// 节假日：apisbo 接口优先，失败回退内置离线数据
const FALLBACK_HOLIDAYS = {
  2026: [
    { date: "2026-01-01", name: "元旦", type: "holiday" },
    { date: "2026-01-02", name: "元旦", type: "holiday" },
    { date: "2026-01-03", name: "元旦", type: "holiday" },
    { date: "2026-01-04", name: "元旦调休", type: "workday" },
    { date: "2026-02-15", name: "春节", type: "holiday" },
    { date: "2026-02-16", name: "春节", type: "holiday" },
    { date: "2026-02-17", name: "春节", type: "holiday" },
    { date: "2026-02-18", name: "春节", type: "holiday" },
    { date: "2026-02-19", name: "春节", type: "holiday" },
    { date: "2026-02-20", name: "春节", type: "holiday" },
    { date: "2026-02-21", name: "春节", type: "holiday" },
    { date: "2026-02-22", name: "春节", type: "holiday" },
    { date: "2026-02-23", name: "春节", type: "holiday" },
    { date: "2026-02-14", name: "春节调休", type: "workday" },
    { date: "2026-02-28", name: "春节调休", type: "workday" },
    { date: "2026-04-04", name: "清明节", type: "holiday" },
    { date: "2026-04-05", name: "清明节", type: "holiday" },
    { date: "2026-04-06", name: "清明节", type: "holiday" },
    { date: "2026-05-01", name: "劳动节", type: "holiday" },
    { date: "2026-05-02", name: "劳动节", type: "holiday" },
    { date: "2026-05-03", name: "劳动节", type: "holiday" },
    { date: "2026-05-04", name: "劳动节", type: "holiday" },
    { date: "2026-05-05", name: "劳动节", type: "holiday" },
    { date: "2026-05-09", name: "劳动节调休", type: "workday" },
    { date: "2026-06-19", name: "端午节", type: "holiday" },
    { date: "2026-06-20", name: "端午节", type: "holiday" },
    { date: "2026-06-21", name: "端午节", type: "holiday" },
    { date: "2026-09-25", name: "中秋节", type: "holiday" },
    { date: "2026-09-26", name: "中秋节", type: "holiday" },
    { date: "2026-09-27", name: "中秋节", type: "holiday" },
    { date: "2026-10-01", name: "国庆节", type: "holiday" },
    { date: "2026-10-02", name: "国庆节", type: "holiday" },
    { date: "2026-10-03", name: "国庆节", type: "holiday" },
    { date: "2026-10-04", name: "国庆节", type: "holiday" },
    { date: "2026-10-05", name: "国庆节", type: "holiday" },
    { date: "2026-10-06", name: "国庆节", type: "holiday" },
    { date: "2026-10-07", name: "国庆节", type: "holiday" },
    { date: "2026-09-20", name: "国庆节调休", type: "workday" },
    { date: "2026-10-10", name: "国庆节调休", type: "workday" }
  ],
};

function parseHolidays(data) {
  const info = { byMonth: {}, makeupByMonth: {}, days: [] };
  for (const d of data) {
    const isOffDay = d.type === 'holiday';
    const dt = new Date(d.date + 'T00:00:00');
    const m = dt.getMonth() + 1, dow = dt.getDay(), isWeekend = dow === 0 || dow === 6;
    info.days.push({ name: d.name, date: d.date, isOffDay });
    if (isOffDay) { if (!isWeekend) info.byMonth[m] = (info.byMonth[m] || 0) + 1; }
    else info.makeupByMonth[m] = (info.makeupByMonth[m] || 0) + 1;
  }
  return info;
}
const fallbackHolidays = year => FALLBACK_HOLIDAYS[year] ? parseHolidays(FALLBACK_HOLIDAYS[year]) : null;

let curHolidays = fallbackHolidays(new Date().getFullYear()) || { byMonth: {}, makeupByMonth: {}, days: [] };
let loadedYear = null;
let holidayLoading = true;

const HOLIDAY_API = 'https://api.apisbo.com/holidays/year/';

const holidayCacheKey = y => 'niuma_holidays_' + y;
function readHolidayCache(y) {
  try {
    const raw = localStorage.getItem(holidayCacheKey(y));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.info || Date.now() - (o.ts || 0) > 365 * 86400000) return null;
    return o.info;
  } catch (e) { return null; }
}
function writeHolidayCache(y, info) {
  try { localStorage.setItem(holidayCacheKey(y), JSON.stringify({ ts: Date.now(), info })); } catch (e) {}
}

async function fetchHolidays(year) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);   // 8s 超时转兜底
    const res = await fetch(HOLIDAY_API + year, { signal: ctrl.signal, cache: 'force-cache' });
    clearTimeout(timer);
    const json = await res.json();
    if (!json || json.code !== 0 || !Array.isArray(json.data)) throw new Error('bad payload');
    const info = parseHolidays(json.data);
    writeHolidayCache(year, info);
    $('hnote').textContent = '';
    return info;
  } catch (e) {
    const fb = fallbackHolidays(year);
    if (fb) {
      writeHolidayCache(year, fb);
      $('hnote').textContent = '注：节假日接口暂不可用，已使用内置离线数据';
      return fb;
    }
    $('hnote').textContent = '注：节假日接口暂不可用，本月未扣除法定节假日';
    return { byMonth: {}, makeupByMonth: {}, days: [] };
  }
}

function ensureHolidays(now) {
  const y = now.getFullYear();
  if (y === loadedYear) return;
  loadedYear = y;
  const cached = readHolidayCache(y);
  if (cached) {
    curHolidays = cached;
    holidayLoading = false;
    tick();
    return;
  }
  holidayLoading = true;
  tick();
  fetchHolidays(y).then(info => { curHolidays = info; holidayLoading = false; tick(); });
}

(function ticks() {
  const g = $('ticks'); let s = '';
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * Math.PI / 180;
    const r1 = i % 5 === 0 ? 82 : 88, r2 = 94;
    const x1 = 100 + r1 * Math.sin(a), y1 = 100 - r1 * Math.cos(a);
    const x2 = 100 + r2 * Math.sin(a), y2 = 100 - r2 * Math.cos(a);
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${i % 5 === 0 ? 'stroke-width="3"' : ''}/>`;
  }
  g.innerHTML = s;
})();

function config() {
  const salary = Math.max(0, parseFloat($('salary').value) || 0);
  const restMode = $('restMode').value;
  const altThisWeek = $('altThisWeek').value;
  const [sh, sm] = ($('start').value || '09:00').split(':').map(Number);
  const [eh, em] = ($('end').value || '18:00').split(':').map(Number);
  const brk = $('break').checked;
  const [bsh, bsm] = ($('breakStart').value || '12:00').split(':').map(Number);
  const [beh, bem] = ($('breakEnd').value || '13:00').split(':').map(Number);
  const payday = Math.max(1, Math.min(31, parseInt($('payday').value) || 10));
  const startMin = sh * 60 + sm, endMin = eh * 60 + em;
  const breakStart = bsh * 60 + bsm, breakEnd = beh * 60 + bem;

  let workMin = endMin - startMin;
  if (workMin <= 0) workMin += 1440;
  let breakMin = 0;
  if (brk && breakStart >= startMin && breakEnd <= endMin && breakEnd > breakStart) {
    breakMin = breakEnd - breakStart;
  }
  const dailyHours = Math.max(0.1, (workMin - breakMin) / 60);
  return { salary, restMode, altThisWeek, startMin, endMin, brk, breakStart, breakEnd, breakMin, dailyHours, payday };
}

// 某日期所在周的周一
function weekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

// 大小周：以当前周为基准逐周交替单休/双休
function weekType(c, date) {
  if (c.restMode !== 'alt') return c.restMode;
  const anchor = weekMonday(new Date());
  const wd = Math.round((weekMonday(date) - anchor) / 604800000);
  if (wd % 2 === 0) return c.altThisWeek;
  return c.altThisWeek === 'double' ? 'single' : 'double';
}

// 某天是否休息日（周末规则；法定节假日另行处理）
function isRestDay(c, date) {
  const dow = date.getDay();
  if (dow !== 0 && dow !== 6) return false;
  const mode = weekType(c, date);
  if (mode === 'none') return false;
  if (mode === 'single') return dow === 0;
  if (mode === 'double') return true;
  return false;
}

function restDaysInMonth(c, now) {
  const dim = daysInMonth(now);
  const y = now.getFullYear(), mo = now.getMonth();
  let n = 0;
  for (let d = 1; d <= dim; d++) if (isRestDay(c, new Date(y, mo, d))) n++;
  return n;
}

// 当月工作天数 = 总天数 − 休息天数 − 法定假日 + 调休补班
function monthlyWorkdays(c, now) {
  const dim = daysInMonth(now);
  const m = now.getMonth() + 1;
  const hw = (curHolidays.byMonth && curHolidays.byMonth[m]) || 0;
  const mu = (curHolidays.makeupByMonth && curHolidays.makeupByMonth[m]) || 0;
  return Math.max(0.1, dim - restDaysInMonth(c, now) - hw + mu);
}

// 当月 1 日至今已结束工作日的累计工时（小时）
function pastWorkedHours(c, now) {
  const y = now.getFullYear(), mo = now.getMonth();
  const today = now.getDate();
  let h = 0;
  for (let d = 1; d < today; d++) {
    if (isWorkday(c, new Date(y, mo, d))) h += c.dailyHours;
  }
  return h;
}

function isWorkday(c, now) {
  const m = now.getMonth() + 1, day = now.getDate();
  if (curHolidays.days) {
    for (const d of curHolidays.days) {
      const dt = new Date(d.date + 'T00:00:00');
      if (dt.getMonth() + 1 === m && dt.getDate() === day) return !d.isOffDay;
    }
  }
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return !isRestDay(c, now);
  return true;
}

function workSeconds(c, dm) {
  const crossing = c.endMin <= c.startMin;
  let segs = crossing ? [[c.startMin, 1440], [0, c.endMin]] : [[c.startMin, c.endMin]];
  if (c.brk && c.breakEnd > c.breakStart) {
    const nb = [];
    for (const [a, b] of segs) {
      const ia = Math.max(a, c.breakStart), ib = Math.min(b, c.breakEnd);
      if (ia < ib) { if (ia > a) nb.push([a, ia]); if (ib < b) nb.push([ib, b]); }
      else nb.push([a, b]);
    }
    segs = nb;
  }
  let sec = 0, total = 0;
  for (const [a, b] of segs) {
    total += (b - a) * 60;
    if (dm > a) sec += Math.min(dm, b) - a;
  }
  return { sec: Math.max(0, sec) * 60, total };
}

// 表盘进度弧：12 小时制比例（0=12:00）
const R_ARC = 78;
const frac = m => ((m % 720) / 720);
function arcPath(f0, f1, R) {
  let span = f1 - f0; if (span < 0) span += 1;
  if (span <= 0.0001) return '';
  const a0 = f0 * 2 * Math.PI, a1 = f1 * 2 * Math.PI;
  const x0 = (100 + R * Math.sin(a0)).toFixed(2), y0 = (100 - R * Math.cos(a0)).toFixed(2);
  const x1 = (100 + R * Math.sin(a1)).toFixed(2), y1 = (100 - R * Math.cos(a1)).toFixed(2);
  const large = span > 0.5 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}

function quoteFor(phase) {
  const map = {
    rest:   '今天休息，老板亏了你一整天的劳动力',
    before: '还没出门？老板的财富正在等你到位',
    morning:'上午的牛马，最廉价的黄金时段',
    noon:   '午休中，这口饭也是用时间换的，别点太贵',
    after:  '下午的班，熬一秒是一秒',
    end:    '快了快了，下班在向你招手',
    done:   '今日打工结束，记得充电明天继续'
  };
  return map[phase] || '';
}

function daysToPayday(c, now) {
  const y = now.getFullYear(), m = now.getMonth();
  const dim = daysInMonth(now);
  const day = Math.min(c.payday, dim);
  let target = new Date(y, m, day);
  const todayMid = new Date(y, m, now.getDate());
  if (target < todayMid) {
    const ny = m === 11 ? y + 1 : y, nm = (m + 1) % 12;
    target = new Date(ny, nm, Math.min(c.payday, daysInMonth(new Date(ny, nm, 1))));
  }
  return Math.round((target - todayMid) / 86400000);
}

// 距离本周休息：最近休息日（含今天）
function daysToRest(c, now) {
  if (c.restMode === 'none') return null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i <= 13; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (isRestDay(c, d)) return i;
  }
  return null;
}

// 最近法定节假日（含名称）
function nextHoliday(now) {
  if (!curHolidays.days) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best = null;
  for (const d of curHolidays.days) {
    if (!d.isOffDay) continue;
    const dt = new Date(d.date + 'T00:00:00');
    const diff = Math.round((dt - today) / 86400000);
    if (diff >= 0 && (best === null || diff < best.diff)) best = { name: d.name, diff };
  }
  return best;
}

function tick() {
  const now = new Date();
  ensureHolidays(now);
  const c = config();
  const dayMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const crossing = c.endMin <= c.startMin;
  const mwd = monthlyWorkdays(c, now);
  const dailyRate = c.salary / mwd;

  const ms = now.getMilliseconds();
  const secA = now.getSeconds() + ms / 1000;
  const minA = now.getMinutes() + secA / 60;
  const hrA  = (now.getHours() % 12) + minA / 60;
  $('sec').setAttribute('transform', `rotate(${secA * 6} 100 100)`);
  $('min').setAttribute('transform', `rotate(${minA * 6} 100 100)`);
  $('hour').setAttribute('transform', `rotate(${hrA * 30} 100 100)`);

  let phase, elapsedSec, leftMin, pct;
  const inWindow = crossing ? (dayMin >= c.startMin || dayMin < c.endMin)
                            : (dayMin >= c.startMin && dayMin < c.endMin);

  if (!isWorkday(c, now)) {
    phase = 'rest'; elapsedSec = 0; leftMin = 0; pct = 0;
  } else if (!inWindow) {
    const r = workSeconds(c, dayMin);
    if (dayMin < c.startMin && !crossing) {
      phase = 'before'; elapsedSec = 0; leftMin = c.startMin - dayMin; pct = 0;
    } else if (!crossing && dayMin >= c.endMin) {
      phase = 'done'; elapsedSec = r.total; leftMin = 0; pct = 100;
    } else {
      phase = 'before'; elapsedSec = 0;
      leftMin = crossing ? ((1440 - dayMin) + c.startMin) : (c.startMin - dayMin);
      pct = 0;
    }
  } else {
    const r = workSeconds(c, dayMin);
    elapsedSec = Math.min(r.sec, r.total);
    pct = r.total > 0 ? Math.min(100, elapsedSec / r.total * 100) : 0;
    leftMin = crossing ? ((dayMin >= c.startMin ? (1440 - dayMin) + c.endMin : c.endMin - dayMin)) : (c.endMin - dayMin);
    if (c.brk && dayMin >= c.breakStart && dayMin < c.breakEnd) phase = 'noon';
    else if (!crossing && dayMin - c.startMin < 180) phase = 'morning';
    else if (!crossing && dayMin >= c.endMin - 90) phase = 'end';
    else phase = 'after';
  }

  const hourly = dailyRate / c.dailyHours;
  const earned = elapsedSec * (hourly / 3600);
  $('earned').textContent = fmt(earned);
  $('persec').textContent = fmt(hourly / 3600, 4)
  $('hourly').textContent = '¥' + fmt(hourly);
  const wh = Math.floor(elapsedSec / 3600), wm = Math.floor((elapsedSec % 3600) / 60);
  $('worked').textContent = wh + 'h' + wm + 'm';
  if (leftMin <= 0) $('left').textContent = '已下班';
  else {
    const lh = Math.floor(leftMin / 60), lm = Math.floor(leftMin % 60);
    $('left').textContent = lh + 'h' + lm + 'm';
  }
  $('pct').textContent = pct.toFixed(0) + '%';
  $('fill').style.width = pct + '%';

  const f0 = frac(c.startMin), f1w = frac(c.endMin);
  const spanFrac = (f1w - f0 + 1) % 1;
  const winOn = isWorkday(c, now) && spanFrac > 0.0001;
  const winArc = winOn ? arcPath(f0, f1w, R_ARC) : '';
  const brkArc = (winOn && c.brk && c.breakEnd > c.breakStart && c.breakStart >= c.startMin && c.breakEnd <= c.endMin)
    ? arcPath(frac(c.breakStart), frac(c.breakEnd), R_ARC) : '';
  const progArc = winOn && pct > 0 ? arcPath(f0, (f0 + (pct / 100) * spanFrac) % 1, R_ARC) : '';
  $('windowArc').setAttribute('d', winArc);
  $('breakArc').setAttribute('d', brkArc);
  $('ring').setAttribute('d', progArc);

  $('quote').textContent = quoteFor(phase);

  const monthWorkedHours = pastWorkedHours(c, now) + elapsedSec / 3600;
  $('monthEarned').textContent = '¥' + fmt(monthWorkedHours * hourly);
  let dayRemainMoney = 0;
  if (isWorkday(c, now)) {
    const r = workSeconds(c, dayMin);
    dayRemainMoney = Math.max(0, (r.total - r.sec) / 3600 * hourly);
  }
  $('dayRemain').textContent = '¥' + fmt(dayRemainMoney);
  const monthRemainMoney = Math.max(0, c.salary - monthWorkedHours * hourly);
  $('monthRemain').textContent = '¥' + fmt(monthRemainMoney);

  const fishSec = renderFishTime();
  $('monthFish').textContent = '¥' + fmt((fishSec / 3600) * hourly);
  if (holidayLoading) {
    if (!$('monthDays').querySelector('.spinner')) $('monthDays').innerHTML = '<span class="spinner"></span>';
  } else {
    $('monthDays').textContent = fmt(mwd, 1);
  }

  const pd = daysToPayday(c, now);
  $('payLeft').textContent = pd === 0 ? '今天发薪' : pd + '天';

  const rl = daysToRest(c, now);
  $('restLeft').textContent = rl === null ? '无休'
    : rl === 0 ? '今天休息'
    : rl === 1 ? '明天休息'
    : (rl - 1) + '天';

  if (holidayLoading) {
    if (!$('holidayLeft').querySelector('.spinner')) $('holidayLeft').innerHTML = '<span class="spinner"></span>';
  } else {
    const nh = nextHoliday(now);
    if (nh) {
      $('holidayLabel').textContent = '距离' + nh.name;
      $('holidayLeft').textContent = nh.diff === 0 ? '今天放假' : nh.diff + '天';
    } else {
      $('holidayLabel').textContent = '距离法定节假日';
      $('holidayLeft').textContent = '今年已无';
    }
  }

  const retireVal = $('retire').value;
  if (!retireVal) {
    $('retireLeft').textContent = '未设置';
  } else {
    const rt = new Date(retireVal + 'T00:00:00');
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rd = Math.round((rt - todayMid) / 86400000);
    $('retireLeft').textContent = rd <= 0 ? (rd === 0 ? '今天退休' : '已退休') : rd + '天';
  }
}

const SETTINGS_KEY = 'niuma_settings';
function saveSettings() {
  const s = {
    salary: $('salary').value,
    restMode: $('restMode').value,
    altThisWeek: $('altThisWeek').value,
    start: $('start').value,
    end: $('end').value,
    brk: $('break').checked,
    breakStart: $('breakStart').value,
    breakEnd: $('breakEnd').value,
    payday: $('payday').value,
    retire: $('retire').value,
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}
function loadSettings() {
  const s = lsGet(SETTINGS_KEY);
  if (!s) return;
  if (s.salary !== undefined) $('salary').value = s.salary;
  if (s.restMode !== undefined) $('restMode').value = s.restMode;
  if (s.altThisWeek !== undefined) $('altThisWeek').value = s.altThisWeek;
  if (s.start !== undefined) $('start').value = s.start;
  if (s.end !== undefined) $('end').value = s.end;
  if (s.brk !== undefined) $('break').checked = !!s.brk;
  if (s.breakStart !== undefined) $('breakStart').value = s.breakStart;
  if (s.breakEnd !== undefined) $('breakEnd').value = s.breakEnd;
  if (s.payday !== undefined) $('payday').value = s.payday;
  if (s.retire !== undefined) $('retire').value = s.retire;
  $('breakWrap').style.display = $('break').checked ? 'block' : 'none';
  $('altWrap').style.display = $('restMode').value === 'alt' ? 'block' : 'none';
}

// 摸鱼计时：按天分桶，跨午夜拆分；本月=当月各日之和
const FISH_KEY = 'niuma_fish';
let fishByDay = {}, fishRunning = false, fishStart = 0;
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + g;
}
function accrueRange(fromTs, toTs) {
  let t = fromTs;
  while (t < toTs) {
    const d = new Date(t);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const segEnd = Math.min(toTs, dayEnd);
    const k = dayKey(d);
    fishByDay[k] = (fishByDay[k] || 0) + (segEnd - t) / 1000;
    t = segEnd;
  }
}
function accrue() {
  if (!fishRunning) return;
  const now = Date.now();
  accrueRange(fishStart, now);
  fishStart = now;
}
function fishMonthSec() {
  const now = new Date();
  const prefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-';
  let s = 0;
  for (const k in fishByDay) if (k.indexOf(prefix) === 0) s += fishByDay[k];
  return s;
}
function fishTodaySec() { return fishByDay[dayKey(new Date())] || 0; }
function loadFish() {
  try {
    const o = lsGet(FISH_KEY);
    if (o) {
      fishByDay = (o.byDay && typeof o.byDay === 'object') ? o.byDay : {};
      fishRunning = !!o.running;
      fishStart = o.running ? (o.start || Date.now()) : 0;
      if (o.sec && !o.byDay) fishByDay[dayKey(new Date())] = o.sec; // 兼容旧版
    }
  } catch (e) {}
}
function saveFish() {
  accrue();
  try { localStorage.setItem(FISH_KEY, JSON.stringify({ byDay: fishByDay, running: fishRunning, start: fishStart })); } catch (e) {}
}
function fmtHM(sec) {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h + 'h' + m + 'm';
}
function renderFishTime() {
  accrue();
  const sec = fishMonthSec();
  $('fishTime').textContent = fmtHM(sec);
  $('todayFish').textContent = fmtHM(fishTodaySec());
  return sec;
}
function renderFish() {
  renderFishTime();
  const card = $('fishBtn');
  if (fishRunning) { card.classList.add('running'); $('fishLabel').textContent = '暂停'; }
  else { card.classList.remove('running'); $('fishLabel').textContent = '摸鱼'; }
}
function toggleFish() {
  accrue();
  fishRunning = !fishRunning;
  if (fishRunning) fishStart = Date.now();
  saveFish(); renderFish(); tick();
}
function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    settings: lsGet(SETTINGS_KEY),
    fish: lsGet(FISH_KEY),
    holidays: {}
  };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('niuma_holidays_') === 0) { try { data.holidays[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '牛马工资时钟_数据_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.settings) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
          loadSettings();
          if ($('restModeBox').setActive) $('restModeBox').setActive($('restMode').value);
          if ($('altThisWeekBox').setActive) $('altThisWeekBox').setActive($('altThisWeek').value);
        }
        if (data.fish) localStorage.setItem(FISH_KEY, JSON.stringify(data.fish));
        loadFish(); renderFish();
        if (data.holidays) {
          for (const k in data.holidays) {
            try { localStorage.setItem(k, JSON.stringify(data.holidays[k])); } catch (e) {}
          }
          loadedYear = null;
          ensureHolidays(new Date());
        }
        tick();
      } catch (e) {
        alert('导入失败：文件格式不正确');
      }
    };
    r.readAsText(f);
  });
  inp.click();
}

function persist() { saveSettings(); tick(); }

['salary','restMode','altThisWeek','start','end','breakStart','breakEnd','payday','retire'].forEach(id => {
  $(id).addEventListener('input', persist);
  $(id).addEventListener('change', persist);
});
$('break').addEventListener('change', () => {
  $('breakWrap').style.display = $('break').checked ? 'block' : 'none';
  saveSettings();
  tick();
});
$('restMode').addEventListener('change', () => {
  $('altWrap').style.display = $('restMode').value === 'alt' ? 'block' : 'none';
  tick();
});

// 自定义下拉：点击选项同步隐藏 select
function initSelect(boxId, triggerId) {
  const box = $(boxId), trigger = $(triggerId), sel = box.querySelector('select'), menu = box.querySelector('.sel-menu');
  function setActive(val) {
    [...menu.children].forEach(li => li.classList.toggle('active', li.dataset.val === val));
    const opt = [...sel.options].find(o => o.value === val);
    trigger.firstChild.textContent = opt ? opt.textContent : val;
  }
  setActive(sel.value);
  box.setActive = setActive;
  box.addEventListener('click', e => {
    const li = e.target.closest('.sel-menu li');
    if (li) {
      if (li.dataset.val !== sel.value) { sel.value = li.dataset.val; setActive(li.dataset.val); sel.dispatchEvent(new Event('change')); }
      box.classList.remove('open');
      e.stopPropagation();
      return;
    }
    document.querySelectorAll('.select.open').forEach(b => { if (b !== box) b.classList.remove('open'); });
    box.classList.toggle('open');
    e.stopPropagation();
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); box.classList.toggle('open'); }
    else if (e.key === 'Escape') box.classList.remove('open');
  });
}
loadSettings();
loadFish();
renderFish();
initSelect('restModeBox', 'restModeTrigger');
initSelect('altThisWeekBox', 'altThisWeekTrigger');
document.addEventListener('click', () => {
  document.querySelectorAll('.select.open').forEach(b => b.classList.remove('open'));
});

// 数字步进按钮：±step 后同步 input
document.querySelectorAll('.stepper button').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = $(btn.dataset.target);
    const step = parseFloat(inp.step) || 1, dir = parseInt(btn.dataset.dir, 10);
    let v = parseFloat(inp.value);
    if (isNaN(v)) v = parseFloat(inp.min) || 0;
    v += dir * step;
    if (inp.min !== '' && !isNaN(parseFloat(inp.min))) v = Math.max(parseFloat(inp.min), v);
    if (inp.max !== '' && !isNaN(parseFloat(inp.max))) v = Math.min(parseFloat(inp.max), v);
    inp.value = v;
    inp.dispatchEvent(new Event('input'));
  });
});

const overlay = $('overlay');
$('settingsBtn').addEventListener('click', () => overlay.style.display = 'flex');
$('closeBtn').addEventListener('click', () => overlay.style.display = 'none');
$('fishBtn').addEventListener('click', toggleFish);
$('fishBtn').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFish(); } });
window.addEventListener('beforeunload', saveFish);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveFish(); });
$('exportBtn').addEventListener('click', exportData);
$('importBtn').addEventListener('click', importData);
$('doneBtn').addEventListener('click', () => overlay.style.display = 'none');
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });

tick();
setInterval(tick, 200);
