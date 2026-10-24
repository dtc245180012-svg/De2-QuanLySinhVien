// tests/status.test.js - unit tests for the time/status logic in attendance controller
'use strict';

const { internal } = require('../src/controllers/attendance.controller');

const { statusForCheckIn, statusForCheckOut } = internal;

function mockNow(h, m) {
    const d = new Date('2024-01-15T00:00:00Z');
    d.setUTCHours(h);
    d.setUTCMinutes(m);
    return d;
}

describe('statusForCheckIn', () => {
    test('on_time when exactly at WORK_START', () => {
        expect(statusForCheckIn(mockNow(0, 0), '2024-01-15')).toBe('on_time');  // 00:00 UTC = 07:00 VN
    });
    test('on_time when within grace', () => {
        expect(statusForCheckIn(mockNow(0, 5), '2024-01-15')).toBe('on_time');  // 00:05 UTC = 07:05 VN
    });
    test('late after grace', () => {
        expect(statusForCheckIn(mockNow(0, 15), '2024-01-15')).toBe('late');    // 00:15 UTC = 07:15 VN
    });
    test('on_time with custom student shift start', () => {
        expect(statusForCheckIn(mockNow(6, 0), '2024-01-15', '13:00')).toBe('on_time'); // 06:00 UTC = 13:00 VN (Afternoon shift)
    });
});

describe('statusForCheckOut', () => {
    test('on_time at WORK_END', () => {
        expect(statusForCheckOut(mockNow(4, 30))).toBe('on_time');              // 04:30 UTC = 11:30 VN
    });
    test('on_time within grace window', () => {
        expect(statusForCheckOut(mockNow(4, 25))).toBe('on_time');              // 04:25 UTC = 11:25 VN
    });
    test('early_leave when too early', () => {
        expect(statusForCheckOut(mockNow(3, 0))).toBe('early_leave');           // 03:00 UTC = 10:00 VN
    });
});
