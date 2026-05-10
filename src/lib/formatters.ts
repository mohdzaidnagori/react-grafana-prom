export interface FormattedValue {
  text: string;
  prefix?: string;
  suffix?: string;
}

export type DecimalCount = number | null | undefined;
export type ValueFormatter = (value: number | null | undefined, decimals?: DecimalCount) => FormattedValue;

export interface ValueFormat {
  name: string;
  id: string;
  fn: ValueFormatter;
}

export interface ValueFormatCategory {
  name: string;
  formats: Array<Omit<ValueFormat, 'fn'> & { fn?: ValueFormatter }>;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function formattedValueToString(value: FormattedValue): string {
  return `${value.prefix ?? ''}${value.text}${value.suffix ?? ''}`;
}

export function toFixed(value: number, decimals?: DecimalCount): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (!Number.isFinite(value)) {
    return value.toLocaleString();
  }

  const resolvedDecimals = decimals ?? getDecimalsForValue(value);
  if (value === 0) {
    return value.toFixed(resolvedDecimals);
  }

  const factor = resolvedDecimals ? Math.pow(10, Math.max(0, resolvedDecimals)) : 1;
  const formatted = String(Math.round(value * factor) / factor);

  if (formatted.includes('e')) {
    return formatted;
  }

  const decimalPosition = formatted.indexOf('.');
  const precision = decimalPosition === -1 ? 0 : formatted.length - decimalPosition - 1;

  if (precision < resolvedDecimals) {
    return (precision ? formatted : `${formatted}.`) + String(factor).slice(1, resolvedDecimals - precision + 1);
  }

  return formatted;
}

function getDecimalsForValue(value: number): number {
  const absolute = Math.abs(value);

  if (absolute === 0 || Number.isInteger(value)) {
    return 0;
  }

  const log10 = Math.floor(Math.log(absolute) / Math.LN10);
  let decimals = -log10 + 1;
  const magnitude = Math.pow(10, -decimals);
  const normalized = absolute / magnitude;

  if (normalized > 2.25) {
    decimals += 1;
  }

  return Math.max(0, decimals);
}

function toFixedUnit(unit: string, asPrefix = false): ValueFormatter {
  return (value, decimals) => {
    if (value === null || value === undefined) {
      return { text: '' };
    }

    const text = toFixed(value, decimals);

    if (!unit) {
      return { text };
    }

    return asPrefix ? { text, prefix: unit } : { text, suffix: ` ${unit}` };
  };
}

function locale(value: number | null | undefined, decimals?: DecimalCount): FormattedValue {
  if (value === null || value === undefined) {
    return { text: '' };
  }

  return {
    text: value.toLocaleString(undefined, {
      maximumFractionDigits: decimals ?? undefined,
      minimumFractionDigits: decimals ?? undefined,
    }),
  };
}

function scientific(value: number | null | undefined, decimals?: DecimalCount): FormattedValue {
  if (value === null || value === undefined) {
    return { text: '' };
  }

  return { text: value.toExponential(decimals ?? 2) };
}

function scaledUnits(factor: number, units: string[], offset = 0): ValueFormatter {
  return (value, decimals) => {
    if (value === null || value === undefined) {
      return { text: '' };
    }

    if (!Number.isFinite(value) || Number.isNaN(value)) {
      return { text: value.toLocaleString() };
    }

    const index = value === 0 ? 0 : Math.floor(Math.log(Math.abs(value)) / Math.log(factor));
    const suffixIndex = clamp(offset + index, 0, units.length - 1);
    const scalePower = clamp(index, -offset, units.length - offset - 1);

    return {
      text: toFixed(value / factor ** scalePower, decimals),
      suffix: units[suffixIndex],
    };
  };
}

const SI_PREFIXES = ['f', 'p', 'n', '\u00b5', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
const SI_BASE_INDEX = SI_PREFIXES.indexOf('');
const BINARY_PREFIXES = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'];

function getOffsetFromSIPrefix(prefix: string): number {
  const normalized = prefix === 'u' ? '\u00b5' : prefix;
  const index = SI_PREFIXES.findIndex((item) => item.normalize('NFKD') === normalized.normalize('NFKD'));
  return index < 0 ? 0 : index - SI_BASE_INDEX;
}

function siPrefix(unit: string, offset = 0): ValueFormatter {
  return scaledUnits(1000, SI_PREFIXES.map((prefix) => ` ${prefix}${unit}`), SI_BASE_INDEX + offset);
}

function binaryPrefix(unit: string, offset = 0): ValueFormatter {
  return scaledUnits(1024, BINARY_PREFIXES.map((prefix) => ` ${prefix}${unit}`), offset);
}

function currency(symbol: string, asSuffix = false): ValueFormatter {
  const scaler = scaledUnits(1000, ['', 'K', 'M', 'B', 'T']);

  return (value, decimals) => {
    if (value === null || value === undefined) {
      return { text: '' };
    }

    const negative = value < 0;
    const scaled = scaler(Math.abs(value), decimals);

    if (asSuffix) {
      scaled.suffix = `${scaled.suffix ?? ''}${symbol}`;
    } else {
      scaled.prefix = `${negative ? '-' : ''}${symbol}`;
    }

    if (negative && asSuffix) {
      scaled.prefix = '-';
    }

    return scaled;
  };
}

function toPercent(value: number | null | undefined, decimals?: DecimalCount): FormattedValue {
  if (value === null || value === undefined) {
    return { text: '' };
  }

  return { text: toFixed(value, decimals), suffix: '%' };
}

function toPercentUnit(value: number | null | undefined, decimals?: DecimalCount): FormattedValue {
  if (value === null || value === undefined) {
    return { text: '' };
  }

  return { text: toFixed(value * 100, decimals), suffix: '%' };
}

function simpleCountUnit(symbol: string): ValueFormatter {
  const scaler = scaledUnits(1000, ['', 'K', 'M', 'B', 'T']);

  return (value, decimals) => {
    const formatted = scaler(value, decimals);
    formatted.suffix = `${formatted.suffix ?? ''} ${symbol}`;
    return formatted;
  };
}

function booleanValueFormatter(trueText: string, falseText: string): ValueFormatter {
  return (value) => ({ text: value ? trueText : falseText });
}

function durationFromMilliseconds(value: number | null | undefined): FormattedValue {
  if (value === null || value === undefined) {
    return { text: '' };
  }

  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const seconds = Math.floor(absolute / 1000);
  const ms = Math.floor(absolute % 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const hms = [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');

  if (days > 0) {
    return { text: `${sign}${days}d ${hms}` };
  }

  if (seconds > 0) {
    return { text: `${sign}${hms}` };
  }

  return { text: `${sign}${ms}`, suffix: ' ms' };
}

const formatterIndex = new Map<string, ValueFormatter>();

function define(id: string, formatter: ValueFormatter): ValueFormatter {
  formatterIndex.set(id, formatter);
  return formatter;
}

export const valueFormatCategories: ValueFormatCategory[] = [
  {
    name: 'Misc',
    formats: [
      { name: 'Number', id: 'none', fn: define('none', toFixedUnit('')) },
      { name: 'String', id: 'string', fn: define('string', (value) => ({ text: `${value ?? ''}` })) },
      {
        name: 'Short',
        id: 'short',
        fn: define('short', scaledUnits(1000, ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr'])),
      },
      { name: 'SI short', id: 'sishort', fn: define('sishort', siPrefix('')) },
      { name: 'Percent (0-100)', id: 'percent', fn: define('percent', toPercent) },
      { name: 'Percent (0.0-1.0)', id: 'percentunit', fn: define('percentunit', toPercentUnit) },
      { name: 'Humidity', id: 'humidity', fn: define('humidity', toFixedUnit('%H')) },
      { name: 'Decibel', id: 'dB', fn: define('dB', toFixedUnit('dB')) },
      { name: 'Scientific notation', id: 'sci', fn: define('sci', scientific) },
      { name: 'Locale format', id: 'locale', fn: define('locale', locale) },
    ],
  },
  {
    name: 'Data',
    formats: [
      { name: 'bytes(IEC)', id: 'bytes', fn: define('bytes', binaryPrefix('B')) },
      { name: 'bytes(SI)', id: 'decbytes', fn: define('decbytes', siPrefix('B')) },
      { name: 'bits(IEC)', id: 'bits', fn: define('bits', binaryPrefix('b')) },
      { name: 'bits(SI)', id: 'decbits', fn: define('decbits', siPrefix('b')) },
      { name: 'kibibytes', id: 'kbytes', fn: define('kbytes', binaryPrefix('B', 1)) },
      { name: 'kilobytes', id: 'deckbytes', fn: define('deckbytes', siPrefix('B', 1)) },
      { name: 'mebibytes', id: 'mbytes', fn: define('mbytes', binaryPrefix('B', 2)) },
      { name: 'megabytes', id: 'decmbytes', fn: define('decmbytes', siPrefix('B', 2)) },
      { name: 'gibibytes', id: 'gbytes', fn: define('gbytes', binaryPrefix('B', 3)) },
      { name: 'gigabytes', id: 'decgbytes', fn: define('decgbytes', siPrefix('B', 3)) },
      { name: 'tebibytes', id: 'tbytes', fn: define('tbytes', binaryPrefix('B', 4)) },
      { name: 'terabytes', id: 'dectbytes', fn: define('dectbytes', siPrefix('B', 4)) },
      { name: 'pebibytes', id: 'pbytes', fn: define('pbytes', binaryPrefix('B', 5)) },
      { name: 'petabytes', id: 'decpbytes', fn: define('decpbytes', siPrefix('B', 5)) },
    ],
  },
  {
    name: 'Data rate',
    formats: [
      { name: 'packets/sec', id: 'pps', fn: define('pps', siPrefix('p/s')) },
      { name: 'bytes/sec(IEC)', id: 'binBps', fn: define('binBps', binaryPrefix('B/s')) },
      { name: 'bytes/sec(SI)', id: 'Bps', fn: define('Bps', siPrefix('B/s')) },
      { name: 'bits/sec(IEC)', id: 'binbps', fn: define('binbps', binaryPrefix('b/s')) },
      { name: 'bits/sec(SI)', id: 'bps', fn: define('bps', siPrefix('b/s')) },
      { name: 'kibibytes/sec', id: 'KiBs', fn: define('KiBs', binaryPrefix('B/s', 1)) },
      { name: 'kilobytes/sec', id: 'KBs', fn: define('KBs', siPrefix('B/s', 1)) },
      { name: 'mebibytes/sec', id: 'MiBs', fn: define('MiBs', binaryPrefix('B/s', 2)) },
      { name: 'megabytes/sec', id: 'MBs', fn: define('MBs', siPrefix('B/s', 2)) },
      { name: 'gibibytes/sec', id: 'GiBs', fn: define('GiBs', binaryPrefix('B/s', 3)) },
      { name: 'gigabytes/sec', id: 'GBs', fn: define('GBs', siPrefix('B/s', 3)) },
      { name: 'kilobits/sec', id: 'Kbits', fn: define('Kbits', siPrefix('b/s', 1)) },
      { name: 'megabits/sec', id: 'Mbits', fn: define('Mbits', siPrefix('b/s', 2)) },
      { name: 'gigabits/sec', id: 'Gbits', fn: define('Gbits', siPrefix('b/s', 3)) },
    ],
  },
  {
    name: 'Time',
    formats: [
      { name: 'Hertz', id: 'hertz', fn: define('hertz', siPrefix('Hz')) },
      { name: 'Nanoseconds', id: 'ns', fn: define('ns', toFixedUnit('ns')) },
      { name: 'Microseconds', id: 'us', fn: define('us', toFixedUnit('us')) },
      { name: 'Milliseconds', id: 'ms', fn: define('ms', toFixedUnit('ms')) },
      { name: 'Seconds', id: 's', fn: define('s', toFixedUnit('s')) },
      { name: 'Minutes', id: 'm', fn: define('m', toFixedUnit('m')) },
      { name: 'Hours', id: 'h', fn: define('h', toFixedUnit('h')) },
      { name: 'Days', id: 'd', fn: define('d', toFixedUnit('d')) },
      { name: 'Duration (ms)', id: 'dtdurationms', fn: define('dtdurationms', durationFromMilliseconds) },
      { name: 'Duration (s)', id: 'dtdurations', fn: define('dtdurations', (value) => durationFromMilliseconds((value ?? 0) * 1000)) },
      { name: 'Duration (hh:mm:ss)', id: 'dthms', fn: define('dthms', (value) => durationFromMilliseconds((value ?? 0) * 1000)) },
      { name: 'Duration (d hh:mm:ss)', id: 'dtdhms', fn: define('dtdhms', (value) => durationFromMilliseconds((value ?? 0) * 1000)) },
    ],
  },
  {
    name: 'Throughput',
    formats: [
      { name: 'counts/sec', id: 'cps', fn: define('cps', simpleCountUnit('c/s')) },
      { name: 'ops/sec', id: 'ops', fn: define('ops', simpleCountUnit('ops/s')) },
      { name: 'requests/sec', id: 'reqps', fn: define('reqps', simpleCountUnit('req/s')) },
      { name: 'reads/sec', id: 'rps', fn: define('rps', simpleCountUnit('rd/s')) },
      { name: 'writes/sec', id: 'wps', fn: define('wps', simpleCountUnit('wr/s')) },
      { name: 'I/O ops/sec', id: 'iops', fn: define('iops', simpleCountUnit('io/s')) },
      { name: 'events/sec', id: 'eps', fn: define('eps', simpleCountUnit('evt/s')) },
      { name: 'messages/sec', id: 'mps', fn: define('mps', simpleCountUnit('msg/s')) },
      { name: 'records/sec', id: 'recps', fn: define('recps', simpleCountUnit('rec/s')) },
      { name: 'rows/sec', id: 'rowsps', fn: define('rowsps', simpleCountUnit('rows/s')) },
      { name: 'counts/min', id: 'cpm', fn: define('cpm', simpleCountUnit('c/m')) },
      { name: 'ops/min', id: 'opm', fn: define('opm', simpleCountUnit('ops/m')) },
      { name: 'requests/min', id: 'reqpm', fn: define('reqpm', simpleCountUnit('req/m')) },
    ],
  },
  {
    name: 'Currency',
    formats: [
      { name: 'Dollars', id: 'currencyUSD', fn: define('currencyUSD', currency('$')) },
      { name: 'Euro', id: 'currencyEUR', fn: define('currencyEUR', currency('EUR ')) },
      { name: 'Pounds', id: 'currencyGBP', fn: define('currencyGBP', currency('GBP ')) },
      { name: 'Indian Rupee', id: 'currencyINR', fn: define('currencyINR', currency('INR ')) },
      { name: 'Yen', id: 'currencyJPY', fn: define('currencyJPY', currency('JPY ')) },
      { name: 'Bitcoin', id: 'currencyBTC', fn: define('currencyBTC', currency('BTC ')) },
    ],
  },
  {
    name: 'Temperature',
    formats: [
      { name: 'Celsius', id: 'celsius', fn: define('celsius', toFixedUnit('C')) },
      { name: 'Fahrenheit', id: 'fahrenheit', fn: define('fahrenheit', toFixedUnit('F')) },
      { name: 'Kelvin', id: 'kelvin', fn: define('kelvin', toFixedUnit('K')) },
    ],
  },
  {
    name: 'Boolean',
    formats: [
      { name: 'True / False', id: 'bool', fn: define('bool', booleanValueFormatter('True', 'False')) },
      { name: 'Yes / No', id: 'bool_yes_no', fn: define('bool_yes_no', booleanValueFormatter('Yes', 'No')) },
      { name: 'On / Off', id: 'bool_on_off', fn: define('bool_on_off', booleanValueFormatter('On', 'Off')) },
    ],
  },
];

formatterIndex.set('\u00b5s', formatterIndex.get('us') ?? toFixedUnit('us'));
formatterIndex.set('farenheit', formatterIndex.get('fahrenheit') ?? toFixedUnit('F'));

export function registerValueFormat(id: string, formatter: ValueFormatter): void {
  formatterIndex.set(id, formatter);
}

export function getValueFormat(id?: string | null): ValueFormatter {
  if (!id) {
    return formatterIndex.get('none') ?? toFixedUnit('');
  }

  const direct = formatterIndex.get(id);
  if (direct) {
    return direct;
  }

  const splitIndex = id.indexOf(':');

  if (splitIndex > 0) {
    const key = id.slice(0, splitIndex);
    const value = id.slice(splitIndex + 1);

    if (key === 'prefix') {
      return toFixedUnit(value, true);
    }

    if (key === 'suffix') {
      return toFixedUnit(value);
    }

    if (key === 'si') {
      const offset = getOffsetFromSIPrefix(value.charAt(0));
      const unit = offset === 0 ? value : value.slice(1);
      return siPrefix(unit, offset);
    }

    if (key === 'count') {
      return simpleCountUnit(value);
    }

    if (key === 'currency') {
      return currency(value);
    }

    if (key === 'bool') {
      const separator = value.indexOf('/');
      return separator >= 0
        ? booleanValueFormatter(value.slice(0, separator), value.slice(separator + 1))
        : booleanValueFormatter(value, '-');
    }
  }

  return toFixedUnit(id);
}

export function getValueFormats(): Array<{ text: string; submenu: Array<{ text: string; value: string }> }> {
  return valueFormatCategories.map((category) => ({
    text: category.name,
    submenu: category.formats.map((format) => ({
      text: format.name,
      value: format.id,
    })),
  }));
}
