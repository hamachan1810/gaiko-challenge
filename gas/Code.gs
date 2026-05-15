// コトバの王国 ― GAS Web App
// スプレッドシートID：デプロイ後にバインドされたスプレッドシートを使用

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;

    switch (data.action) {
      case 'save_config':       result = saveConfig(ss, data);       break;
      case 'save_challenge':    result = saveChallenge(ss, data);    break;
      case 'save_run_summary':  result = saveRunSummary(ss, data);   break;
      case 'save_character':    result = saveCharacter(ss, data);    break;
      case 'save_special_title':result = saveSpecialTitle(ss, data); break;
      case 'get_data':          result = getData(ss);                break;
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
    ['run', 'total_saved', 'total_failed', 'total_skipped',
     'hard_saved', 'hard_selected', 'memo_count', 'max_streak',
     'total_xp_this_run', 'completed_date']);
  // 既存のrun行があれば上書き
  const rows = sheet.getDataRange().getValues();
  const idx = rows.findIndex(r => r[0] === data.run);
  const row = [
    data.run,
    data.total_saved  !== undefined ? data.total_saved  : (data.total_achieved || 0),
    data.total_failed, data.total_skipped,
    data.hard_saved   !== undefined ? data.hard_saved   : (data.hard_achieved  || 0),
    data.hard_selected, data.memo_count, data.max_streak,
    data.total_xp_this_run, data.completed_date || new Date().toISOString()
  ];
  if (idx >= 1) {
    sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

// ── character_log ─────────────────────────────────────────────────────────────

function saveCharacter(ss, data) {
  const sheet = getOrCreateSheet(ss, 'character_log',
    ['run', 'week', 'character_id', 'character_name', 'achieved_count',
     'rescue_status', 'is_full_saved', 'first_met_run', 'completed_date']);
  const rows = sheet.getDataRange().getValues();
  // Check if this run+week already has a row
  const idx = rows.findIndex(r => r[0] === data.run && r[1] === data.week);
  const row = [
    data.run, data.week, data.character_id, data.character_name,
    data.achieved_count, data.rescue_status, data.is_full_saved,
    data.first_met_run, data.completed_date || new Date().toISOString()
  ];
  if (idx >= 1) {
    sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

// ── special_titles ────────────────────────────────────────────────────────────

function saveSpecialTitle(ss, data) {
  const sheet = getOrCreateSheet(ss, 'special_titles',
    ['title_id', 'title_name', 'achieved_date', 'run']);
  const rows = sheet.getDataRange().getValues();
  // Prevent duplicate titles
  const exists = rows.some(r => r[0] === data.title_id);
  if (!exists) {
    sheet.appendRow([data.title_id, data.title_name,
      data.achieved_date || new Date().toISOString(), data.run]);
  }
  return { ok: true };
}

// ── get_data ─────────────────────────────────────────────────────────────────

function getData(ss) {
  const config = sheetToKeyValue(ss, 'game_config');
  const challengeLog = sheetToObjects(ss, 'challenge_log',
    ['run', 'week', 'challenge_id', 'challenge_name', 'difficulty', 'status', 'memo', 'timestamp']);
  const runSummary = sheetToObjects(ss, 'run_summary',
    ['run', 'total_saved', 'total_failed', 'total_skipped',
     'hard_saved', 'hard_selected', 'memo_count', 'max_streak',
     'total_xp_this_run', 'completed_date']);
  const characterLog = sheetToObjects(ss, 'character_log',
    ['run', 'week', 'character_id', 'character_name', 'achieved_count',
     'rescue_status', 'is_full_saved', 'first_met_run', 'completed_date']);
  const specialTitles = sheetToObjects(ss, 'special_titles',
    ['title_id', 'title_name', 'achieved_date', 'run']);
  return { ok: true, config, challengeLog, runSummary, characterLog, specialTitles };
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
