/**
 * PR05 (S4) display capability scripts. Each runs atomically on same-slot
 * keys only: control, the display session binding, the display ACK record
 * and the scene registry. None is the control command script and none
 * writes the operation ledger: a secret-bearing result is never replayed.
 * Secrets never reach Redis — only SHA-256 hex digests travel in ARGV.
 *
 * Generations are integers below 1e14, so cjson's 14 significant digits
 * keep them exact through every re-encode (M1).
 */

/** Shared Lua: the audience-visible target of the current presentation. */
const PROJECT_LUA = `
local function project(state, registryKey)
  local presentation = state.presentation
  local sceneId = cjson.null
  local blanked = false
  local revision = cjson.null
  if type(presentation) == 'table' then
    revision = presentation.revision
    if presentation.blanked == true then
      blanked = true
    elseif type(presentation.sceneId) == 'string' then
      local entryRaw = redis.call('HGET', registryKey, presentation.sceneId)
      if entryRaw then
        local ok, entry = pcall(cjson.decode, entryRaw)
        if ok and type(entry) == 'table' and entry.v == 1 and entry.deleted ~= true
          and entry.sceneId == presentation.sceneId
          and type(entry.sourceMapId) == 'string' and string.len(entry.sourceMapId) > 0 then
          sceneId = presentation.sceneId
        end
      end
    end
  end
  return sceneId, blanked, revision
end
`;

/** Shared Lua: capability hash + bound-nonce verification (E4). */
const VERIFY_LUA = `
local function decodeControl(raw)
  if not raw then return nil, 'expired' end
  local ok, state = pcall(cjson.decode, raw)
  if not ok or type(state) ~= 'table' or state.v ~= 1 then return nil, 'unavailable' end
  if type(state.displayCapabilityHash) ~= 'string' or state.displayCapabilityHash ~= ARGV[1]
    or type(state.displayGeneration) ~= 'number' or state.displayGeneration < 1 then
    return nil, 'expired'
  end
  return state, nil
end
local function checkBinding(state, controlKey, sessionKey, nonceHash, bind)
  local pttl = redis.call('PTTL', controlKey)
  local bindingRaw = redis.call('GET', sessionKey)
  local binding = nil
  if bindingRaw then
    local ok, parsed = pcall(cjson.decode, bindingRaw)
    if ok and type(parsed) == 'table' then binding = parsed end
  end
  if binding and binding.displayGeneration == state.displayGeneration then
    if binding.nonceHash ~= nonceHash then return 'in-use' end
    -- R4-F5: the binding never outlives or underlives control.
    if pttl > 0 then redis.call('PEXPIRE', sessionKey, pttl) else redis.call('PERSIST', sessionKey) end
    return 'ok'
  end
  if not bind then return 'unbound' end
  local value = cjson.encode({displayGeneration=state.displayGeneration, nonceHash=nonceHash})
  if pttl > 0 then redis.call('SET', sessionKey, value, 'PX', pttl)
  else redis.call('SET', sessionKey, value) end
  return 'ok'
end
`;

/**
 * M2 rotation: KEYS control, session, ack; ARGV capabilityHash, generation.
 * Requires an existing control record; replaces only displayGeneration and
 * displayCapabilityHash (never `revision`), keeps the control TTL (KEEPTTL)
 * and deletes the binding and ACK record.
 */
export const DISPLAY_ROTATE_SCRIPT = `
local controlKey, sessionKey, ackKey = KEYS[1], KEYS[2], KEYS[3]
local hash, generation = ARGV[1], tonumber(ARGV[2])
if type(hash) ~= 'string' or string.len(hash) ~= 64 or not generation
  or generation < 1 or generation >= 100000000000000 or generation ~= math.floor(generation) then
  return cjson.encode({status='invalid'})
end
local raw = redis.call('GET', controlKey)
if not raw then return cjson.encode({status='not-initialized'}) end
local ok, state = pcall(cjson.decode, raw)
if not ok or type(state) ~= 'table' or state.v ~= 1 then
  return cjson.encode({status='unavailable'})
end
if state.displayGeneration == generation then return cjson.encode({status='collision'}) end
state.displayGeneration = generation
state.displayCapabilityHash = hash
redis.call('SET', controlKey, cjson.encode(state), 'KEEPTTL')
redis.call('DEL', sessionKey, ackKey)
return cjson.encode({status='rotated', displayGeneration=generation})
`;

/**
 * E4/E6 verification: KEYS control, session, registry; ARGV capabilityHash,
 * nonceHash, bind ('1' only for the descriptor read). Returns the control
 * record and the presented registry entry for the descriptor projection.
 */
export const DISPLAY_VERIFY_SCRIPT = `
local controlKey, sessionKey, registryKey = KEYS[1], KEYS[2], KEYS[3]
${VERIFY_LUA}
local raw = redis.call('GET', controlKey)
local state, failure = decodeControl(raw)
if not state then return cjson.encode({status=failure}) end
local bound = checkBinding(state, controlKey, sessionKey, ARGV[2], ARGV[3] == '1')
if bound ~= 'ok' then return cjson.encode({status=bound}) end
local entry = cjson.null
if type(state.presentation) == 'table' and type(state.presentation.sceneId) == 'string' then
  entry = redis.call('HGET', registryKey, state.presentation.sceneId) or cjson.null
end
return cjson.encode({status='ok', control=raw, entry=entry})
`;

/** PR07 M1: the display's scale self-report enum (ACK and status). */
const CALIBRATION_LUA = `
local CALIBRATION = {['uncalibrated']=true, ['verified']=true,
  ['verify-required']=true, ['unsupported']=true}
`;

/**
 * E7 ACK: KEYS control, session, ack, registry; ARGV capabilityHash,
 * nonceHash, ack JSON (exact keys, validated by the caller). The tuple must
 * equal the current control projection; the record is stamped with Redis
 * TIME and kept for 30 s. PR07 M1: an optional `calibration` enum is
 * re-validated here and stored in the same v1 record (absent → omitted).
 */
export const DISPLAY_ACK_SCRIPT = `
local controlKey, sessionKey, ackKey, registryKey = KEYS[1], KEYS[2], KEYS[3], KEYS[4]
${VERIFY_LUA}
${PROJECT_LUA}
${CALIBRATION_LUA}
local raw = redis.call('GET', controlKey)
local state, failure = decodeControl(raw)
if not state then return cjson.encode({status=failure}) end
local bound = checkBinding(state, controlKey, sessionKey, ARGV[2], false)
if bound == 'unbound' then return cjson.encode({status='stale'}) end
if bound ~= 'ok' then return cjson.encode({status=bound}) end
local ackOk, ack = pcall(cjson.decode, ARGV[3])
if not ackOk or type(ack) ~= 'table' then return cjson.encode({status='invalid'}) end
local sceneId, blanked, revision = project(state, registryKey)
if ack.epoch ~= state.epoch or ack.displayGeneration ~= state.displayGeneration
  or ack.presentationRevision ~= revision or ack.blanked ~= blanked
  or ack.sceneId ~= sceneId then
  return cjson.encode({status='stale'})
end
if ack.phase == 'loaded' and sceneId == cjson.null then return cjson.encode({status='stale'}) end
if ack.phase == 'blank' and sceneId ~= cjson.null then return cjson.encode({status='stale'}) end
if ack.phase ~= 'loaded' and ack.phase ~= 'blank' then return cjson.encode({status='invalid'}) end
local calibration = ack.calibration
if calibration ~= nil and (type(calibration) ~= 'string' or not CALIBRATION[calibration]) then
  return cjson.encode({status='invalid'})
end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
redis.call('SET', ackKey, cjson.encode({v=1, displayGeneration=state.displayGeneration,
  epoch=state.epoch, presentationRevision=revision, sceneId=sceneId, blanked=blanked,
  phase=ack.phase, calibration=calibration, receivedAt=now}), 'EX', 30)
return cjson.encode({status='recorded', receivedAt=now})
`;

/**
 * E13 DM status: KEYS control, ack, registry. Computed with Redis TIME
 * against current control; returns no capability, hash, nonce or
 * generation. PR07 M1: `calibration` only for fresh matching records.
 */
export const DISPLAY_STATUS_SCRIPT = `
local controlKey, ackKey, registryKey = KEYS[1], KEYS[2], KEYS[3]
${PROJECT_LUA}
${CALIBRATION_LUA}
local none = cjson.encode({state='none', sceneId=cjson.null, ageMs=cjson.null})
local raw = redis.call('GET', controlKey)
if not raw then return none end
local ok, state = pcall(cjson.decode, raw)
if not ok or type(state) ~= 'table' or state.v ~= 1 then return cjson.encode({state='unavailable'}) end
if type(state.displayGeneration) ~= 'number' or state.displayGeneration < 1 then return none end
local ackRaw = redis.call('GET', ackKey)
if not ackRaw then return none end
local ackOk, ack = pcall(cjson.decode, ackRaw)
if not ackOk or type(ack) ~= 'table' or type(ack.receivedAt) ~= 'number' then return none end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local age = now - ack.receivedAt
if age < 0 then age = 0 end
if age >= 15000 then
  return cjson.encode({state='stale', sceneId=ack.sceneId, ageMs=age})
end
local sceneId, blanked, revision = project(state, registryKey)
local matches = ack.epoch == state.epoch and ack.displayGeneration == state.displayGeneration
  and ack.presentationRevision == revision and ack.sceneId == sceneId and ack.blanked == blanked
if not matches then
  return cjson.encode({state='updating', sceneId=ack.sceneId, ageMs=age})
end
local value = 'waiting'
if blanked then value = 'blank'
elseif sceneId ~= cjson.null and ack.phase == 'loaded' then value = 'loaded' end
local calibration = nil
if type(ack.calibration) == 'string' and CALIBRATION[ack.calibration] then
  calibration = ack.calibration
end
return cjson.encode({state=value, sceneId=sceneId, ageMs=age, calibration=calibration})
`;
