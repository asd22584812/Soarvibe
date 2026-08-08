/**
 * Travel Time Engine tests (P0 + inspiration/precise modes).
 * Usage: node scripts/test-travel-time-engine.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'travel-time-engine.js'), 'utf8');
const context = { console, globalThis: {} };
context.window = context.globalThis;
vm.createContext(context);
vm.runInContext(code, context, { filename: 'travel-time-engine.js' });
const E = context.globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error('FAIL:', msg);
}

// --- Precise mode: complete flight ---
const payload = {
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'NRT',
  flightDeparture: '2026-08-10T08:00',
  flightArrival: '2026-08-10T10:30',
  flightReturnFrom: 'NRT',
  flightReturnTo: 'TPE',
  flightReturn: '2026-08-15T19:00',
  accommodation: '淺草飯店',
  customerSelectedTransport: 'public-transit'
};

const n = E.normalizeFlightPayload(payload);
assert(E.hasCompleteFlightData(payload) === true, 'complete flight → hasCompleteFlightData');
assert(n.planningMode === 'precise', 'complete flight → precise mode');
assert(n.hardConstraints.active === true, 'complete flight → hardConstraints.active');
assert(n.arrival.hhmm === '10:30', 'arrival hhmm preserved');
assert(n.departure.hhmm === '08:00', 'departure hhmm preserved');
assert(n.arrival.timezone === 'Asia/Tokyo', 'arrival timezone Tokyo');
assert(n.departure.timezone === 'Asia/Taipei', 'departure timezone Taipei');
assert(n.buffers.arrivalBufferMinutes >= 60, 'intl arrival buffer >= 60');
assert(n.buffers.earliestSightseeingHhmm, 'earliest sightseeing set');
const earliest = E.hhmmToMinutes(n.buffers.earliestSightseeingHhmm);
assert(earliest >= E.hhmmToMinutes('10:30') + 60, 'sightseeing after arrival+buffer');
assert(n.verification.source === 'user_provided_flight_time', 'verification adapter user_provided');
assert(n.hardConstraints.forbidAiInventFlightTimes === true, 'forbid invent');

const prompt = E.buildFlightHardConstraintPrompt(n);
assert(prompt.includes('HARD CONSTRAINT'), 'prompt has HARD CONSTRAINT');
assert(prompt.includes('10:30'), 'prompt has arrival');
assert(prompt.includes('transportConstraints'), 'prompt has transportConstraints');

const badHidden = {
  meta: {},
  days: [
    {
      dayNum: '1',
      phases: [
        {
          label: '上午',
          items: [
            {
              title: '秋葉原逛街',
              startTime: '09:00',
              endTime: '10:00',
              timeLabel: '09:00 - 10:00'
            },
            {
              title: '淺草寺',
              startTime: '10:05',
              endTime: '11:00',
              timeLabel: '10:05 - 11:00'
            }
          ]
        }
      ]
    },
    {
      dayNum: '2',
      phases: [
        {
          label: '下午',
          items: [
            {
              title: '購物',
              startTime: '16:00',
              endTime: '18:30',
              timeLabel: '16:00 - 18:30'
            }
          ]
        }
      ]
    }
  ]
};

const qa = E.applyTimeQaToHidden(badHidden, payload);
assert(qa.fixes.length > 0, 'QA produces fixes');
const day1First = qa.hidden.days[0].phases[0].items[0];
assert(E.hhmmToMinutes(day1First.startTime) >= earliest, 'Day1 first stop shifted after buffer');
assert(qa.hidden.days[0].phases[0].items[1].startTime > day1First.endTime, 'transfer gap enforced');
assert(
  E.hhmmToMinutes(day1First.startTime) >= E.hhmmToMinutes('10:30'),
  '完整航班 08:00/10:30 → Day1 不得安排 10:30 前的目的地活動'
);

const attached = E.attachToPayload(payload);
assert(attached.arrivalTimezone === 'Asia/Tokyo', 'attach arrivalTimezone');
assert(attached.departureTimezone === 'Asia/Taipei', 'attach departureTimezone');
assert(attached.hasCompleteFlightData === true, 'attach hasCompleteFlightData');

// --- Inspiration: no flight, no hotel ---
const bare = {
  destination: '東京',
  dateStart: '2026-09-01',
  dateEnd: '2026-09-05',
  travelStyle: 'anime',
  accommodation: '',
  accommodations: [{ name: '', checkInNight: null }]
};
assert(E.hasCompleteFlightData(bare) === false, '無航班 → not complete');
assert(E.hasPartialFlightData(bare) === false, '完全空白 → not partial');
const bareN = E.normalizeFlightPayload(bare);
assert(bareN.planningMode === 'inspiration', '無航班 → inspiration');
assert(bareN.hardConstraints.active === false, '無航班 → hardConstraints off');
assert(!bareN.buffers.earliestSightseeingHhmm, '無航班 → 無 earliest sightseeing');
const barePrompt = E.buildFlightHardConstraintPrompt(bareN);
assert(barePrompt.includes('靈感規劃模式'), '無航班 prompt → 靈感模式');
assert(!barePrompt.includes('HARD CONSTRAINT——航班時間不可改'), '無航班 → 無 HARD CONSTRAINT 標題');
const bareAttached = E.attachToPayload(bare);
assert(bareAttached.hasCompleteFlightData === false, 'bare attach not complete');
assert(bareAttached.planningMode === 'inspiration', 'bare attach inspiration');

// Only destination + dates + style (generation gate fields) — engine treats as inspiration
const destOnly = {
  destination: '東京',
  dateStart: '2026-09-01',
  dateEnd: '2026-09-05',
  travelStyle: 'foodie'
};
assert(E.hasCompleteFlightData(destOnly) === false, '只有目的地日期風格 → not complete');
assert(E.normalizeFlightPayload(destOnly).planningMode === 'inspiration', '只有目的地日期風格 → inspiration PASS');

// --- Partial airports only ---
const partial = {
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'NRT'
};
assert(E.hasPartialFlightData(partial) === true, '部分機場 → partial');
assert(E.hasCompleteFlightData(partial) === false, '部分機場 → not complete');
const partialN = E.normalizeFlightPayload(partial);
assert(partialN.planningMode === 'inspiration', '部分航班 → inspiration（一般模式）');
assert(partialN.hardConstraints.active === false, '部分航班 → no HARD CONSTRAINT');
assert(partialN.hasPartialFlightData === true, 'partial flag set');
const partialPrompt = E.buildFlightHardConstraintPrompt(partialN);
assert(partialPrompt.includes('靈感規劃模式'), '部分航班 prompt 仍為靈感模式');

// Partial must NOT invent arrival for hard QA
const partialQaHidden = JSON.parse(JSON.stringify(badHidden));
const partialQa = E.applyTimeQaToHidden(partialQaHidden, partial);
const stillEarly = partialQa.hidden.days[0].phases[0].items[0].startTime;
assert(
  stillEarly === '09:00' ||
    !partialQa.fixes.some(function (f) {
      return f.type === 'shift_after_buffer';
    }),
  '部分航班 → 不因虛構抵達而 shift Day1'
);

// No accommodation invent check (engine doesn't invent hotels; assert empty stays empty)
assert(!bare.accommodation, '無住宿欄位保持空白（不得產生假住宿名稱）');

console.log(`travel-time-engine: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
