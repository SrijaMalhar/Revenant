var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// ossuary/timespan/original/lib/time-span.js
var require_time_span = __commonJS({
  "ossuary/timespan/original/lib/time-span.js"(exports) {
    var msecPerSecond = 1e3;
    var msecPerMinute = 6e4;
    var msecPerHour = 36e5;
    var msecPerDay = 864e5;
    var timeSpanWithDays = /^(\d+):(\d+):(\d+):(\d+)(\.\d+)?/;
    var timeSpanNoDays = /^(\d+):(\d+):(\d+)(\.\d+)?/;
    var TimeSpan = exports.TimeSpan = function(milliseconds, seconds, minutes, hours, days) {
      this.msecs = 0;
      if (isNumeric(days)) {
        this.msecs += days * msecPerDay;
      }
      if (isNumeric(hours)) {
        this.msecs += hours * msecPerHour;
      }
      if (isNumeric(minutes)) {
        this.msecs += minutes * msecPerMinute;
      }
      if (isNumeric(seconds)) {
        this.msecs += seconds * msecPerSecond;
      }
      if (isNumeric(milliseconds)) {
        this.msecs += milliseconds;
      }
    };
    exports.fromMilliseconds = function(milliseconds) {
      if (!isNumeric(milliseconds)) {
        return;
      }
      return new TimeSpan(milliseconds, 0, 0, 0, 0);
    };
    exports.fromSeconds = function(seconds) {
      if (!isNumeric(seconds)) {
        return;
      }
      return new TimeSpan(0, seconds, 0, 0, 0);
    };
    exports.fromMinutes = function(minutes) {
      if (!isNumeric(minutes)) {
        return;
      }
      return new TimeSpan(0, 0, minutes, 0, 0);
    };
    exports.fromHours = function(hours) {
      if (!isNumeric(hours)) {
        return;
      }
      return new TimeSpan(0, 0, 0, hours, 0);
    };
    exports.fromDays = function(days) {
      if (!isNumeric(days)) {
        return;
      }
      return new TimeSpan(0, 0, 0, 0, days);
    };
    exports.parse = function(str) {
      var match, milliseconds;
      function parseMilliseconds(value) {
        return value ? parseFloat("0" + value) * 1e3 : 0;
      }
      if (match = str.match(timeSpanWithDays)) {
        return new TimeSpan(parseMilliseconds(match[5]), match[4], match[3], match[2], match[1]);
      }
      if (match = str.match(timeSpanNoDays)) {
        return new TimeSpan(parseMilliseconds(match[4]), match[3], match[2], match[1], 0);
      }
      return null;
    };
    var parsers = {
      "milliseconds": {
        exp: /(\d+)milli(?:second)?[s]?/i,
        compute: function(delta, computed) {
          return _compute(delta, computed, {
            current: "milliseconds",
            next: "seconds",
            max: 1e3
          });
        }
      },
      "seconds": {
        exp: /(\d+)second[s]?/i,
        compute: function(delta, computed) {
          return _compute(delta, computed, {
            current: "seconds",
            next: "minutes",
            max: 60
          });
        }
      },
      "minutes": {
        exp: /(\d+)minute[s]?/i,
        compute: function(delta, computed) {
          return _compute(delta, computed, {
            current: "minutes",
            next: "hours",
            max: 60
          });
        }
      },
      "hours": {
        exp: /(\d+)hour[s]?/i,
        compute: function(delta, computed) {
          return _compute(delta, computed, {
            current: "hours",
            next: "days",
            max: 24
          });
        }
      },
      "days": {
        exp: /(\d+)day[s]?/i,
        compute: function(delta, computed) {
          var days = monthDays(computed.months, computed.years), sign = delta >= 0 ? 1 : -1, opsign = delta >= 0 ? -1 : 1, clean = 0;
          function update(months2) {
            if (months2 < 0) {
              computed.years -= 1;
              return 11;
            } else if (months2 > 11) {
              computed.years += 1;
              return 0;
            }
            return months2;
          }
          if (delta) {
            while (Math.abs(delta) >= days) {
              computed.months += sign * 1;
              computed.months = update(computed.months);
              delta += opsign * days;
              days = monthDays(computed.months, computed.years);
            }
            computed.days += opsign * delta;
          }
          if (computed.days < 0) {
            clean = -1;
          } else if (computed.days > months[computed.months]) {
            clean = 1;
          }
          if (clean === -1 || clean === 1) {
            computed.months += clean;
            computed.months = update(computed.months);
            computed.days = months[computed.months] + computed.days;
          }
          return computed;
        }
      },
      "months": {
        exp: /(\d+)month[s]?/i,
        compute: function(delta, computed) {
          var round = delta > 0 ? Math.floor : Math.ceil;
          if (delta) {
            computed.years += round.call(null, delta / 12);
            computed.months += delta % 12;
          }
          if (computed.months > 11) {
            computed.years += Math.floor((computed.months + 1) / 12);
            computed.months = (computed.months + 1) % 12 - 1;
          }
          return computed;
        }
      },
      "years": {
        exp: /(\d+)year[s]?/i,
        compute: function(delta, computed) {
          if (delta) {
            computed.years += delta;
          }
          return computed;
        }
      }
    };
    var parserNames = Object.keys(parsers);
    exports.parseDate = function(str) {
      var dateTime = Date.parse(str), iso = "^([^Z]+)", zulu = "Z([\\+|\\-])?", diff = {}, computed, modifiers, sign;
      if (!isNaN(dateTime)) {
        return new Date(dateTime);
      }
      parserNames.forEach(function(group) {
        zulu += "(\\d+[a-zA-Z]+)?";
      });
      if (/^NOW/i.test(str)) {
        dateTime = Date.now();
        zulu = zulu.replace(/Z/, "NOW");
      } else if (/^\-/.test(str) || /^\+/.test(str)) {
        dateTime = Date.now();
        zulu = zulu.replace(/Z/, "");
      } else {
        dateTime = str.match(new RegExp(iso, "i"));
        dateTime = Date.parse(dateTime[1]);
      }
      if (!dateTime || !(modifiers = str.match(new RegExp(zulu, "i")))) {
        return null;
      }
      dateTime = new Date(dateTime);
      sign = modifiers[1] === "+" ? 1 : -1;
      var computed = {
        milliseconds: dateTime.getMilliseconds(),
        seconds: dateTime.getSeconds(),
        minutes: dateTime.getMinutes(),
        hours: dateTime.getHours(),
        days: dateTime.getDate(),
        months: dateTime.getMonth(),
        years: dateTime.getFullYear()
      };
      modifiers.slice(2).filter(Boolean).forEach(function(modifier) {
        parserNames.forEach(function(name) {
          var match;
          if (!(match = modifier.match(parsers[name].exp))) {
            return;
          }
          diff[name] = sign * parseInt(match[1], 10);
        });
      });
      parserNames.forEach(function(name) {
        computed = parsers[name].compute(diff[name], computed);
      });
      return new Date(
        computed.years,
        computed.months,
        computed.days,
        computed.hours,
        computed.minutes,
        computed.seconds,
        computed.milliseconds
      );
    };
    exports.fromDates = function(start, end, abs) {
      if (typeof start === "string") {
        start = exports.parseDate(start);
      }
      if (typeof end === "string") {
        end = exports.parseDate(end);
      }
      if (!(start instanceof Date && end instanceof Date)) {
        return null;
      }
      var differenceMsecs = end.valueOf() - start.valueOf();
      if (abs) {
        differenceMsecs = Math.abs(differenceMsecs);
      }
      return new TimeSpan(differenceMsecs, 0, 0, 0, 0);
    };
    exports.test = function(str) {
      return timeSpanWithDays.test(str) || timeSpanNoDays.test(str);
    };
    exports.instanceOf = function(timeSpan) {
      return timeSpan instanceof TimeSpan;
    };
    exports.clone = function(timeSpan) {
      if (!(timeSpan instanceof TimeSpan)) {
        return;
      }
      return exports.fromMilliseconds(timeSpan.totalMilliseconds());
    };
    TimeSpan.prototype.add = function(timeSpan) {
      if (!(timeSpan instanceof TimeSpan)) {
        return;
      }
      this.msecs += timeSpan.totalMilliseconds();
    };
    TimeSpan.prototype.addMilliseconds = function(milliseconds) {
      if (!isNumeric(milliseconds)) {
        return;
      }
      this.msecs += milliseconds;
    };
    TimeSpan.prototype.addSeconds = function(seconds) {
      if (!isNumeric(seconds)) {
        return;
      }
      this.msecs += seconds * msecPerSecond;
    };
    TimeSpan.prototype.addMinutes = function(minutes) {
      if (!isNumeric(minutes)) {
        return;
      }
      this.msecs += minutes * msecPerMinute;
    };
    TimeSpan.prototype.addHours = function(hours) {
      if (!isNumeric(hours)) {
        return;
      }
      this.msecs += hours * msecPerHour;
    };
    TimeSpan.prototype.addDays = function(days) {
      if (!isNumeric(days)) {
        return;
      }
      this.msecs += days * msecPerDay;
    };
    TimeSpan.prototype.subtract = function(timeSpan) {
      if (!(timeSpan instanceof TimeSpan)) {
        return;
      }
      this.msecs -= timeSpan.totalMilliseconds();
    };
    TimeSpan.prototype.subtractMilliseconds = function(milliseconds) {
      if (!isNumeric(milliseconds)) {
        return;
      }
      this.msecs -= milliseconds;
    };
    TimeSpan.prototype.subtractSeconds = function(seconds) {
      if (!isNumeric(seconds)) {
        return;
      }
      this.msecs -= seconds * msecPerSecond;
    };
    TimeSpan.prototype.subtractMinutes = function(minutes) {
      if (!isNumeric(minutes)) {
        return;
      }
      this.msecs -= minutes * msecPerMinute;
    };
    TimeSpan.prototype.subtractHours = function(hours) {
      if (!isNumeric(hours)) {
        return;
      }
      this.msecs -= hours * msecPerHour;
    };
    TimeSpan.prototype.subtractDays = function(days) {
      if (!isNumeric(days)) {
        return;
      }
      this.msecs -= days * msecPerDay;
    };
    TimeSpan.prototype.totalMilliseconds = function(roundDown) {
      var result = this.msecs;
      if (roundDown === true) {
        result = Math.floor(result);
      }
      return result;
    };
    TimeSpan.prototype.totalSeconds = function(roundDown) {
      var result = this.msecs / msecPerSecond;
      if (roundDown === true) {
        result = Math.floor(result);
      }
      return result;
    };
    TimeSpan.prototype.totalMinutes = function(roundDown) {
      var result = this.msecs / msecPerMinute;
      if (roundDown === true) {
        result = Math.floor(result);
      }
      return result;
    };
    TimeSpan.prototype.totalHours = function(roundDown) {
      var result = this.msecs / msecPerHour;
      if (roundDown === true) {
        result = Math.floor(result);
      }
      return result;
    };
    TimeSpan.prototype.totalDays = function(roundDown) {
      var result = this.msecs / msecPerDay;
      if (roundDown === true) {
        result = Math.floor(result);
      }
      return result;
    };
    TimeSpan.prototype.__defineGetter__("milliseconds", function() {
      return this.msecs % 1e3;
    });
    TimeSpan.prototype.__defineGetter__("seconds", function() {
      return Math.floor(this.msecs / msecPerSecond) % 60;
    });
    TimeSpan.prototype.__defineGetter__("minutes", function() {
      return Math.floor(this.msecs / msecPerMinute) % 60;
    });
    TimeSpan.prototype.__defineGetter__("hours", function() {
      return Math.floor(this.msecs / msecPerHour) % 24;
    });
    TimeSpan.prototype.__defineGetter__("days", function() {
      return Math.floor(this.msecs / msecPerDay);
    });
    TimeSpan.prototype.equals = function(timeSpan) {
      if (!(timeSpan instanceof TimeSpan)) {
        return;
      }
      return this.msecs === timeSpan.totalMilliseconds();
    };
    TimeSpan.prototype.toString = function() {
      if (!this.format) {
        return this._format();
      }
      return this.format(this);
    };
    TimeSpan.prototype._format = function() {
      return [
        this.days,
        this.hours,
        this.minutes,
        this.seconds + "." + this.milliseconds
      ].join(":");
    };
    function isNumeric(input) {
      return input && !isNaN(parseFloat(input)) && isFinite(input);
    }
    function _compute(delta, computed, options) {
      var current = options.current, next = options.next, max = options.max, round = delta > 0 ? Math.floor : Math.ceil;
      if (delta) {
        computed[next] += round.call(null, delta / max);
        computed[current] += delta % max;
      }
      if (Math.abs(computed[current]) >= max) {
        computed[next] += round.call(null, computed[current] / max);
        computed[current] = computed[current] % max;
      }
      return computed;
    }
    var months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function monthDays(month, year) {
      if ((year % 100 !== 0 && year % 4 === 0 || year % 400 === 0) && month === 1) {
        return 29;
      }
      return months[month];
    }
  }
});
export default require_time_span();
