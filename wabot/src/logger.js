/**
 * Terminal Verbose & Debug Logger for Smart Warehouse WABot
 * Provides formatted, colorful, and styled terminal logs for message routing,
 * scanner events, PPO workflows, inventory searches, and connection lifecycle.
 */

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m'
};

function timestamp() {
  const d = new Date();
  const pad = (n, s = 2) => String(n).padStart(s, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${colors.gray}${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}.${ms}${colors.reset}`;
}

function tag(name, color = colors.cyan) {
  return `${colors.bold}${color}[${name.padEnd(8, ' ')}]${colors.reset}`;
}

const logger = {
  banner() {
    console.log(`
${colors.brightCyan}╔══════════════════════════════════════════════════════════════════════╗
║        🏭 SMART WAREHOUSE & PPO BOT — VERBOSE TERMINAL ENGINE        ║
║   Status: ${colors.brightGreen}ACTIVE${colors.brightCyan}   │   Mode: ${colors.brightYellow}VERBOSE / DEBUG${colors.brightCyan}   │   Node: ${colors.brightWhite}${process.version}${colors.brightCyan}              ║
╚══════════════════════════════════════════════════════════════════════╝${colors.reset}
`);
  },

  info(moduleTag, message, extra = '') {
    const extraStr = extra ? ` ${colors.gray}${typeof extra === 'object' ? JSON.stringify(extra) : extra}${colors.reset}` : '';
    console.log(`${timestamp()} ${tag(moduleTag, colors.brightBlue)} ${message}${extraStr}`);
  },

  debug(moduleTag, message, extra = '') {
    const extraStr = extra ? ` ${colors.gray}${typeof extra === 'object' ? JSON.stringify(extra) : extra}${colors.reset}` : '';
    console.log(`${timestamp()} ${tag(moduleTag, colors.gray)} ${colors.dim}${message}${colors.reset}${extraStr}`);
  },

  incoming(sender, name, messageType, snippet) {
    const senderDisplay = `${colors.brightWhite}${name || 'Unknown'}${colors.reset} (${colors.yellow}${sender}${colors.reset})`;
    const typeDisplay = `${colors.brightCyan}[${messageType}]${colors.reset}`;
    const preview = snippet ? ` "${colors.white}${snippet.replace(/[\r\n]+/g, ' ').substring(0, 60)}${snippet.length > 60 ? '...' : ''}${colors.reset}"` : '';
    console.log(`${timestamp()} ${tag('MSG-IN', colors.brightCyan)} Dari ${senderDisplay} ${typeDisplay}${preview}`);
  },

  cmd(command, args = [], meta = {}) {
    const argsStr = args.length > 0 ? ` ${colors.yellow}${args.join(' ')}${colors.reset}` : '';
    const userRole = meta.role ? ` [Role: ${colors.brightGreen}${meta.role}${colors.reset}]` : ' [Role: Guest]';
    console.log(`${timestamp()} ${tag('COMMAND', colors.brightMagenta)} Eksekusi ${colors.bold}${colors.brightYellow}!${command}${colors.reset}${argsStr}${userRole}`);
  },

  search(query, count, durationMs, details = '') {
    const countColor = count > 0 ? colors.brightGreen : colors.brightRed;
    const detailStr = details ? ` (${colors.gray}${details}${colors.reset})` : '';
    console.log(`${timestamp()} ${tag('SEARCH', colors.brightBlue)} Cari: "${colors.brightWhite}${query}${colors.reset}" ➔ ${countColor}${count} barang ditemukan${colors.reset} (${colors.yellow}${durationMs}ms${colors.reset})${detailStr}`);
  },

  scanner(engine, status, result, durationMs = null) {
    const statusColor = status === 'SUCCESS' ? colors.brightGreen : status === 'FALLBACK' ? colors.brightYellow : colors.brightRed;
    const timeStr = durationMs !== null ? ` (${colors.yellow}${durationMs}ms${colors.reset})` : '';
    console.log(`${timestamp()} ${tag('SCANNER', colors.brightYellow)} [${engine}] ➔ ${statusColor}${status}${colors.reset}: "${colors.brightWhite}${result}${colors.reset}"${timeStr}`);
  },

  ppo(step, details, sender = '') {
    const senderStr = sender ? ` (${colors.yellow}${sender}${colors.reset})` : '';
    console.log(`${timestamp()} ${tag('PPO-FLOW', colors.cyan)} Tahap: ${colors.bold}${colors.brightCyan}${step}${colors.reset} ➔ ${details}${senderStr}`);
  },

  reply(target, summary, durationMs = null) {
    const timeStr = durationMs !== null ? ` ${colors.gray}(latensi: ${durationMs}ms)${colors.reset}` : '';
    console.log(`${timestamp()} ${tag('REPLY', colors.brightGreen)} Balas ke ${colors.yellow}${target}${colors.reset}: "${colors.white}${summary.replace(/[\r\n]+/g, ' ').substring(0, 75)}${summary.length > 75 ? '...' : ''}${colors.reset}"${timeStr}`);
  },

  tunnel(url, mode = 'LIVE') {
    console.log(`${timestamp()} ${tag('TUNNEL', colors.brightMagenta)} Public URL [${mode}]: ${colors.bold}${colors.brightCyan}${url}${colors.reset}`);
  },

  opname(code, name, oldQty, newQty, user) {
    console.log(`${timestamp()} ${tag('OPNAME', colors.brightGreen)} Update [${code}] "${name}": ${colors.red}${oldQty}${colors.reset} ➔ ${colors.brightGreen}${newQty}${colors.reset} oleh ${colors.brightWhite}${user}${colors.reset}`);
  },

  warn(moduleTag, message) {
    console.log(`${timestamp()} ${tag(moduleTag, colors.brightYellow)} ${colors.yellow}⚠️ ${message}${colors.reset}`);
  },

  error(moduleTag, message, err = null) {
    const errDetail = err ? `\n${colors.red}${err.stack || err.message || err}${colors.reset}` : '';
    console.error(`${timestamp()} ${tag(moduleTag, colors.brightRed)} ${colors.brightRed}❌ ${message}${colors.reset}${errDetail}`);
  }
};

module.exports = logger;
