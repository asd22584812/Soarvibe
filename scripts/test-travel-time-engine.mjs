/**
 * Travel Time Engine tests (P0).
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

const attached = E.attachToPayload(payload);
assert(attached.arrivalTimezone === 'Asia/Tokyo', 'attach arrivalTimezone');
assert(attached.departureTimezone === 'Asia/Taipei', 'attach departureTimezone');

console.log(`travel-time-engine: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
