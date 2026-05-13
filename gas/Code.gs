// コトバの王国 ― GAS Web App
// スプレッドシートID：デプロイ後にバインドされたスプレッドシートを使用

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;

    switch (data.action) {
      case 'save_config':      result = saveConfig(ss, data);      break;
      case 'save_challenge':   result = saveChallenge(ss, data);   break;
      case 'save_run_summary': result = saveRunSummary(ss, data);  break;
      case 'get_data':         result = getData(ss);               break;
      default: result = { ok: false, error: 'unknown action' };
    }

    return buildResponse(result);
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = getData(ss);
    return buildResponse(result);
  } catch (err) {
    return buildResponse({ ok: false, error: err.message });
  }
}

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── game_config ──────────────────────────────────────────────────────────────

function saveConfig(ss, data) {
  const sheet = getOrCreateSheet(ss, 'game_config', ['key', 'value']);
  const keys = Object.keys(data).filter(k => k !== 'action');
  keys.forEach(key => {
    const rows = sheet.getDataRange().getValues();
    const idx = rows.findIndex(r => r[0] === key);
    if (idx >= 1) {
      sheet.getRange(idx + 1, 2).setValue(data[key]);
    } else {
      sheet.appendRow([key, data[key]]);
    }
  });
  return { ok: true };
}

// ── challenge_log ────────────────────────────────────────────────────────────

function saveChallenge(ss, data) {
  const sheet = getOrCreateSheet(ss, 'challenge_log',
    ['run', 'week', 'challenge_id', 'challenge_name', 'difficulty', 'status', 'memo', 'timestamp']);
  sheet.appendRow([
    data.run,
    data.week,
    data.challenge_id,
    data.challenge_name,
    data.difficulty,
    data.status,
    data.memo || '',
    data.timestamp || new Date().toISOString()
  ]);
  return { ok: true };
}

// ── run_summary ──────────────────────────────────────────────────────────────

function saveRunSummary(ss, data) {
  const sheet = getOrCreateSheet(ss, 'run_summary',
    ['run', 'total_achieved', 'total_failed', 'total_skipped',
     'hard_achieved', 'hard_selected', 'memo_count', 'max_streak',
     'total_xp_this_run', 'completed_date']);
  // 既存のrun行があれば上書き
  const rows = sheet.getDataRange().getValues();
  const idx = rows.findIndex(r => r[0] === data.run);
  const row = [
    data.run, data.total_achieved, data.total_failed, data.total_skipped,
    data.hard_achieved, data.hard_selected, data.memo_count, data.max_streak,
    data.total_xp_this_run, data.completed_date || new Date().toISOString()
  ];
  if (idx >= 1) {
    sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

// ── get_data ─────────────────────────────────────────────────────────────────

function getData(ss) {
  const config = sheetToKeyValue(ss, 'game_config');
  const challengeLog = sheetToObjects(ss, 'challenge_log',
    ['run', 'week', 'challenge_id', 'challenge_name', 'difficulty', 'status', 'memo', 'timestamp']);
  const runSummary = sheetToObjects(ss, 'run_summary',
    ['run', 'total_achieved', 'total_failed', 'total_skipped',
     'hard_achieved', 'hard_selected', 'memo_count', 'max_streak',
     'total_xp_this_run', 'completed_date']);
  return { ok: true, config, challengeLog, runSummary };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function sheetToKeyValue(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues().slice(1);
  const obj = {};
  rows.forEach(r => { if (r[0]) obj[r[0]] = r[1]; });
  return obj;
}

function sheetToObjects(ss, name, keys) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(row => {
    const obj = {};
    keys.forEach((k, i) => { obj[k] = row[i]; });
    return obj;
  });
}
