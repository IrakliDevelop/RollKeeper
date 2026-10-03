/**
 * Trusted host appended to the frozen Fieldnotes fog authority library.
 * KEYS[1..2] and ARGV[1] are permanently reserved for the fog ABI.
 */
export const ROLLKEEPER_AUTHORITY_HOST_V1 = String.raw`
local fogMetaKey, fogTilesKey = KEYS[1], KEYS[2]
local metaKey, elementsKey, ownershipKey, layersKey = KEYS[3], KEYS[4], KEYS[5], KEYS[6]
local dedupeKey, dedupeOrderKey, receiptsKey = KEYS[7], KEYS[8], KEYS[9]
local historyKey, evidenceKey, outboxKey, claimsKey = KEYS[10], KEYS[11], KEYS[12], KEYS[13]
local controlKey, registryKey = KEYS[14], KEYS[15]
local playerRateKey = KEYS[16]

local function reject(reason) return {0, reason} end
local expectedTypes = {'hash','hash','string','hash','hash','hash','hash','list','hash','list','hash','list','hash','string','hash','hash'}
for index = 1, #KEYS do
  local actual = redis.call('TYPE', KEYS[index]).ok
  if actual ~= 'none' and actual ~= expectedTypes[index] then return reject('invalid') end
end

local MAX_SAFE_INTEGER = 9007199254740991
local function exact_keys(value, expected)
  if type(value) ~= 'table' then return false end
  local allowed, count = {}, 0
  for _, key in ipairs(expected) do allowed[key] = true end
  for key, _ in pairs(value) do
    if not allowed[key] then return false end
    count = count + 1
  end
  return count == #expected
end
local function ascii(value)
  if type(value) ~= 'string' or #value < 1 or #value > 128 then return false end
  for index = 1, #value do
    local byte = string.byte(value, index)
    if byte < 32 or byte > 126 then return false end
  end
  return true
end
local function safe_integer(value)
  return type(value) == 'number' and value >= 0 and value <= MAX_SAFE_INTEGER
    and value == math.floor(value)
end
local function lowercase_uuid(value)
  return type(value) == 'string'
    and string.match(value, '^[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]%-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]%-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]%-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]%-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]$') ~= nil
end
local function digest(value)
  return type(value) == 'string' and #value == 64
    and string.match(value, '^[0-9a-f]+$') ~= nil
end
local function canonical_revision(value)
  return type(value) == 'string' and (value == '0'
    or string.match(value, '^[1-9][0-9]*$') ~= nil)
end

local ok, app = pcall(cjson.decode, ARGV[2])
if not ok or type(app) ~= 'table' then return reject('invalid') end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if type(app.deadlineAt) ~= 'number' or app.deadlineAt <= now then return reject('expired') end

local controlRaw = redis.call('GET', controlKey)
if not controlRaw then return reject('forbidden') end
local controlOk, control = pcall(cjson.decode, controlRaw)
if not controlOk or type(control) ~= 'table' or control.v ~= 1 or control.epoch ~= app.epoch then
  return reject('forbidden')
end
local registryRaw = redis.call('HGET', registryKey, app.sceneId)
if not registryRaw then return reject('forbidden') end
local registryOk, registry = pcall(cjson.decode, registryRaw)
if not registryOk or type(registry) ~= 'table' or registry.v ~= 1 or registry.deleted == true
  or registry.sceneId ~= app.sceneId or registry.roomId ~= app.room then return reject('forbidden') end

if app.role == 'dm' then
  if type(app.writerFence) ~= 'number' or app.writerFence ~= control.writerFence
    or type(control.leaseUntil) ~= 'number' or control.leaseUntil <= now then return reject('forbidden') end
elseif app.role == 'player' then
  if type(control.presentation) ~= 'table' or control.presentation.sceneId ~= app.sceneId
    or control.presentation.blanked == true or app.playerPrincipal ~= app.ownershipId then return reject('forbidden') end
else
  return reject('forbidden')
end

local metaRaw = redis.call('GET', metaKey)
if not metaRaw then return reject('generation-mismatch') end
local metaOk, meta = pcall(cjson.decode, metaRaw)
if not metaOk or type(meta) ~= 'table' or meta.v ~= 1 or meta.generation ~= app.generation
  or not ascii(meta.generation) or not safe_integer(meta.revision)
  or type(meta.casToken) ~= 'string' then
  return reject('generation-mismatch')
end

if not ascii(app.clientOperationId) or not digest(app.operationDigest)
  or not lowercase_uuid(app.receiptId) then return reject('invalid') end
local previousRevision = tostring(meta.revision)
local nextRevision = tostring(meta.revision + 1)
local generationJson = cjson.encode(meta.generation)
local operationIdJson = cjson.encode(app.clientOperationId)
local receiptIdJson = cjson.encode(app.receiptId)
local receiptJson = '{"generation":' .. generationJson .. ',"clientOperationId":'
  .. operationIdJson .. ',"receiptId":' .. receiptIdJson .. '}'
local result = '{"status":"committed","receipt":' .. receiptJson
  .. ',"position":{"generation":' .. generationJson .. ',"revision":'
  .. cjson.encode(nextRevision) .. '},"replayed":false}'
local pendingDedupeJson = '{"generation":' .. generationJson .. ',"digest":'
  .. cjson.encode(app.operationDigest) .. ',"result":' .. cjson.encode(result)
  .. ',"createdAt":' .. tostring(now) .. ',"expiresAt":' .. tostring(now + 86400000) .. '}'

local dedupeTotal = redis.call('HLEN', dedupeKey)
local receiptTotal = redis.call('HLEN', receiptsKey)
local ordered = redis.call('LRANGE', dedupeOrderKey, 0, -1)
if dedupeTotal > 1024 or receiptTotal > 1024 or #ordered > 1024 then return reject('overloaded') end
if #ordered ~= dedupeTotal or #ordered ~= receiptTotal then return reject('invalid') end
local expiredDedupe, orderedSeen = {}, {}
local liveCount, liveDedupeBytes, liveReceiptBytes = dedupeTotal, 0, 0
local targetSaved, targetResult = nil, nil
local previousCreatedAt = nil
for _, operationId in ipairs(ordered) do
  if not ascii(operationId) then return reject('invalid') end
  if orderedSeen[operationId] then return reject('invalid') end
  orderedSeen[operationId] = true
  local raw = redis.call('HGET', dedupeKey, operationId)
  local pairedReceiptRaw = redis.call('HGET', receiptsKey, operationId)
  if not raw or not pairedReceiptRaw then return reject('invalid') end
  local savedOk, saved = pcall(cjson.decode, raw)
  local resultOk, parsedResult = false, nil
  if savedOk and type(saved) == 'table' and type(saved.result) == 'string' then
    resultOk, parsedResult = pcall(cjson.decode, saved.result)
  end
  local pairedOk, pairedReceipt = pcall(cjson.decode, pairedReceiptRaw)
  if not savedOk or not exact_keys(saved, {'generation','digest','result','createdAt','expiresAt'})
    or saved.generation ~= meta.generation or not digest(saved.digest)
    or type(saved.result) ~= 'string' or not safe_integer(saved.createdAt)
    or not safe_integer(saved.expiresAt) or saved.expiresAt ~= saved.createdAt + 86400000
    or saved.createdAt > now or (previousCreatedAt and saved.createdAt < previousCreatedAt)
    or not resultOk or not exact_keys(parsedResult, {'status','receipt','position','replayed'})
    or parsedResult.status ~= 'committed' or parsedResult.replayed ~= false
    or not exact_keys(parsedResult.receipt, {'generation','clientOperationId','receiptId'})
    or parsedResult.receipt.generation ~= meta.generation
    or parsedResult.receipt.clientOperationId ~= operationId
    or not lowercase_uuid(parsedResult.receipt.receiptId)
    or not exact_keys(parsedResult.position, {'generation','revision'})
    or parsedResult.position.generation ~= meta.generation
    or not canonical_revision(parsedResult.position.revision)
    or not pairedOk or not exact_keys(pairedReceipt, {'generation','clientOperationId','receiptId'})
    or pairedReceipt.generation ~= parsedResult.receipt.generation
    or pairedReceipt.clientOperationId ~= parsedResult.receipt.clientOperationId
    or pairedReceipt.receiptId ~= parsedResult.receipt.receiptId then return reject('invalid') end
  previousCreatedAt = saved.createdAt
  local dedupeBytes = redis.call('HSTRLEN', dedupeKey, operationId)
  local pairedReceiptBytes = redis.call('HSTRLEN', receiptsKey, operationId)
  liveDedupeBytes = liveDedupeBytes + dedupeBytes
  liveReceiptBytes = liveReceiptBytes + pairedReceiptBytes
  if operationId == app.clientOperationId then
    targetSaved, targetResult = saved, parsedResult
  end
  if saved.expiresAt <= now then
    expiredDedupe[#expiredDedupe + 1] = operationId
    liveCount = liveCount - 1
    liveDedupeBytes = liveDedupeBytes - dedupeBytes
    liveReceiptBytes = liveReceiptBytes - pairedReceiptBytes
  end
end
local pendingCount = targetSaved and 0 or 1
local pendingDedupeBytes = targetSaved and 0 or #pendingDedupeJson
local pendingReceiptBytes = targetSaved and 0 or #receiptJson
if liveCount + pendingCount > 1024 or liveDedupeBytes + pendingDedupeBytes > 524288
  or liveReceiptBytes + pendingReceiptBytes > 1048576 then return reject('overloaded') end
if targetSaved then
  if targetSaved.digest ~= app.operationDigest then return reject('operation-id-reused') end
  if targetSaved.expiresAt <= now then return reject('retry-window-expired') end
  targetResult.replayed = true
  return {1, cjson.encode(targetResult)}
end
if redis.call('LLEN', outboxKey) >= 1024 then return reject('overloaded') end

local function sorted_hash_values(key)
  local fields = redis.call('HKEYS', key)
  table.sort(fields)
  local values = {}
  for _, field in ipairs(fields) do
    local raw = redis.call('HGET', key, field)
    if raw then
      local parsedOk, parsed = pcall(cjson.decode, raw)
      if not parsedOk then return nil end
      values[#values + 1] = parsed
    end
  end
  return values
end
local function fog_state()
  local fogMetaRaw = redis.call('HGET', fogMetaKey, 'current')
  if fogMetaRaw then
    local fogOk, fogMeta = pcall(cjson.decode, fogMetaRaw)
    local tiles = sorted_hash_values(fogTilesKey)
    if not fogOk or not tiles then return nil end
    return {meta=fogMeta, tiles=tiles}
  elseif redis.call('HLEN', fogTilesKey) ~= 0 then return nil end
  return cjson.null
end
local function json_array(values)
  if #values == 0 then return '[]' end
  return cjson.encode(values)
end
local function state_json(elements, layers, fog)
  local fogJson = fog == cjson.null and 'null' or '{"meta":' .. cjson.encode(fog.meta)
    .. ',"tiles":' .. json_array(fog.tiles) .. '}'
  return '{"elements":' .. json_array(elements) .. ',"layers":' .. json_array(layers)
    .. ',"extensions":{"fog":{"pluginName":"fog","version":1,"data":' .. fogJson .. '}}}'
end
local function changed_hash_values(key, changedField, changedValue, remove, clear)
  if clear then return {} end
  local fields = redis.call('HKEYS', key)
  if changedValue ~= nil and not remove and redis.call('HEXISTS', key, changedField) == 0 then
    fields[#fields + 1] = changedField
  end
  table.sort(fields)
  local values = {}
  for _, field in ipairs(fields) do
    if field ~= changedField then
      local raw = redis.call('HGET', key, field)
      local parsedOk, parsed = pcall(cjson.decode, raw)
      if not parsedOk then return nil end
      values[#values + 1] = parsed
    elseif not remove then
      values[#values + 1] = changedValue
    end
  end
  return values
end

local kind = app.kind
local retainedOwner = nil
local fogPlan = nil
if kind == 'element-upsert' or kind == 'element-remove' then
  retainedOwner = redis.call('HGET', ownershipKey, app.elementId)
  local currentRaw = redis.call('HGET', elementsKey, app.elementId)
  if currentRaw then
    local currentOk, current = pcall(cjson.decode, currentRaw)
    if not currentOk or type(current) ~= 'table' then return reject('invalid') end
    if app.role == 'player' and (retainedOwner ~= app.ownershipId or current.audience == 'dm') then
      return reject('forbidden')
    end
  elseif app.role == 'player' and kind == 'element-remove' then
    return reject('forbidden')
  elseif retainedOwner and app.role == 'player' and retainedOwner ~= app.ownershipId then
    return reject('forbidden')
  end
  if kind == 'element-remove' and app.role == 'player' and retainedOwner ~= app.ownershipId then
    return reject('forbidden')
  end
  if kind == 'element-upsert' and app.role == 'player' and app.element.audience == 'dm' then
    return reject('forbidden')
  end
elseif kind == 'elements-clear' then
  if app.role ~= 'dm' or type(app.expectedState) ~= 'string' or app.expectedState == ''
    or app.expectedState ~= meta.casToken then return reject('conflict') end
elseif kind == 'layer-write' then
  local layerId = app.record.id
  if app.role == 'player' and layerId ~= 'player-' .. app.ownershipId then return reject('forbidden') end
  local currentRaw = redis.call('HGET', layersKey, layerId)
  if currentRaw then
    local currentOk, current = pcall(cjson.decode, currentRaw)
    if not currentOk or type(current) ~= 'table' then return reject('invalid') end
    if app.record.version < current.version or (app.record.version == current.version and app.record.editor <= current.editor) then
      return reject('conflict')
    end
  end
elseif kind == 'fog' then
  if app.role ~= 'dm' then return reject('forbidden') end
  fogPlan = fn_fog_plan_v1(fogMetaKey, fogTilesKey, ARGV[1])
  if fogPlan[1] ~= 1 then return reject(fogPlan[2]) end
else
  return reject('invalid')
end

local playerRateCommit = app.role == 'player' and kind == 'element-upsert'
local rateNextJson = nil
if playerRateCommit then
  if not ascii(app.ownershipId) then return reject('invalid') end
  local playerCount = redis.call('HLEN', playerRateKey)
  if playerCount > 1024 then return reject('overloaded') end
  local rateRaw = redis.call('HGET', playerRateKey, app.ownershipId)
  if not rateRaw and playerCount >= 1024 then return reject('overloaded') end
  local retained = {}
  if rateRaw then
    if #rateRaw > 512 then return reject('invalid') end
    local rateOk, rate = pcall(cjson.decode, rateRaw)
    if not rateOk or not exact_keys(rate, {'generation','timestamps'})
      or rate.generation ~= meta.generation or type(rate.timestamps) ~= 'table'
      or #rate.timestamps < 1 or #rate.timestamps > 10 then return reject('invalid') end
    local encodedTimestamps = {}
    local previousTimestamp = nil
    for index = 1, #rate.timestamps do
      local timestamp = rate.timestamps[index]
      if not safe_integer(timestamp) or timestamp > now
        or (previousTimestamp and timestamp < previousTimestamp) then return reject('invalid') end
      previousTimestamp = timestamp
      encodedTimestamps[index] = tostring(timestamp)
      if timestamp > now - 1000 then retained[#retained + 1] = timestamp end
    end
    local exactRate = '{"generation":' .. generationJson .. ',"timestamps":['
      .. table.concat(encodedTimestamps, ',') .. ']}'
    if exactRate ~= rateRaw then return reject('invalid') end
  end
  if #retained >= 10 then return reject('overloaded') end
  retained[#retained + 1] = now
  local encodedRetained = {}
  for index = 1, #retained do encodedRetained[index] = tostring(retained[index]) end
  rateNextJson = '{"generation":' .. generationJson .. ',"timestamps":['
    .. table.concat(encodedRetained, ',') .. ']}'
  if #rateNextJson > 512 then return reject('overloaded') end
end

local beforeElements = sorted_hash_values(elementsKey)
local beforeLayers = sorted_hash_values(layersKey)
local beforeFog = fog_state()
if not beforeElements or not beforeLayers or beforeFog == nil then return reject('invalid') end
local beforeJson = state_json(beforeElements, beforeLayers, beforeFog)
if #beforeJson > 20971520 then return reject('overloaded') end

local afterElements, afterLayers, afterFog = beforeElements, beforeLayers, beforeFog
if kind == 'element-upsert' then
  local owner = retainedOwner or app.ownershipId
  app.element.ownerId = owner
  afterElements = changed_hash_values(elementsKey, app.elementId, app.element, false, false)
elseif kind == 'element-remove' then
  afterElements = changed_hash_values(elementsKey, app.elementId, nil, true, false)
elseif kind == 'elements-clear' then
  afterElements = {}
elseif kind == 'layer-write' then
  afterLayers = changed_hash_values(layersKey, app.record.id, app.record, false, false)
elseif kind == 'fog' then
  local fogOk, plannedFog = pcall(cjson.decode, fogPlan[2])
  if not fogOk then return reject('invalid') end
  afterFog = plannedFog
end
if not afterElements or not afterLayers then return reject('invalid') end
local afterJson = state_json(afterElements, afterLayers, afterFog)
if #afterJson > 20971520 then return reject('overloaded') end

local beforeId = app.evidenceId .. ':before'
local afterId = app.evidenceId .. ':after'
local publication = {
  previous={generation=meta.generation,revision=previousRevision},
  position={generation=meta.generation,revision=nextRevision},
  before={id=beforeId,byteLength=#beforeJson,nodes=1},
  after={id=afterId,byteLength=#afterJson,nodes=1}
}
local publicationJson = cjson.encode(publication)

if redis.call('HEXISTS', evidenceKey, beforeId) == 1
  or redis.call('HEXISTS', evidenceKey, afterId) == 1 then return reject('invalid') end
local historyEntries = redis.call('LRANGE', historyKey, 0, -1)
local evidenceCount = redis.call('HLEN', evidenceKey)
if #historyEntries > 1024 or evidenceCount > 2048 then return reject('overloaded') end
local historyBytes, evidenceBytes = 0, 0
local historyPlan, evidenceSeen = {}, {}
for _, encoded in ipairs(historyEntries) do
  historyBytes = historyBytes + #encoded
  local entryOk, entry = pcall(cjson.decode, encoded)
  if not entryOk or type(entry) ~= 'table' or type(entry.before) ~= 'table'
    or type(entry.after) ~= 'table' or type(entry.before.id) ~= 'string'
    or type(entry.after.id) ~= 'string' or entry.before.id == entry.after.id
    or evidenceSeen[entry.before.id] or evidenceSeen[entry.after.id] then
    return reject('invalid')
  end
  local beforeEvidence = redis.call('HGET', evidenceKey, entry.before.id)
  local afterEvidence = redis.call('HGET', evidenceKey, entry.after.id)
  if not beforeEvidence or not afterEvidence then return reject('invalid') end
  evidenceSeen[entry.before.id], evidenceSeen[entry.after.id] = true, true
  evidenceBytes = evidenceBytes + #beforeEvidence + #afterEvidence
  historyPlan[#historyPlan + 1] = {
    beforeId=entry.before.id,
    afterId=entry.after.id,
    historyBytes=#encoded,
    evidenceBytes=#beforeEvidence + #afterEvidence
  }
end
if evidenceCount ~= #historyEntries * 2 then return reject('invalid') end
local retireHistory = 0
while #historyEntries - retireHistory + 1 > 1024
  or historyBytes + #publicationJson > 8388608
  or evidenceCount - retireHistory * 2 + 2 > 2048
  or evidenceBytes + #beforeJson + #afterJson > 41943040 do
  retireHistory = retireHistory + 1
  local retiring = historyPlan[retireHistory]
  if not retiring then return reject('overloaded') end
  historyBytes = historyBytes - retiring.historyBytes
  evidenceBytes = evidenceBytes - retiring.evidenceBytes
end
local outboxEntries = redis.call('LRANGE', outboxKey, 0, -1)
local outboxBytes = #publicationJson
for _, encoded in ipairs(outboxEntries) do outboxBytes = outboxBytes + #encoded end
if outboxBytes > 8388608 then return reject('overloaded') end

-- No validation, capacity decision or fallible serialization remains after this point.
if kind == 'element-upsert' then
  redis.call('HSET', elementsKey, app.elementId, cjson.encode(app.element))
  if not retainedOwner then redis.call('HSET', ownershipKey, app.elementId, app.ownershipId) end
elseif kind == 'element-remove' then
  redis.call('HDEL', elementsKey, app.elementId)
elseif kind == 'elements-clear' then
  redis.call('DEL', elementsKey)
elseif kind == 'layer-write' then
  redis.call('HSET', layersKey, app.record.id, cjson.encode(app.record))
else
  fn_fog_apply_v1(fogMetaKey, fogTilesKey, fogPlan)
end
for _, operationId in ipairs(expiredDedupe) do
  redis.call('HDEL', dedupeKey, operationId)
  redis.call('HDEL', receiptsKey, operationId)
  redis.call('LREM', dedupeOrderKey, 0, operationId)
end
for index = 1, retireHistory do
  redis.call('LPOP', historyKey)
  redis.call('HDEL', evidenceKey, historyPlan[index].beforeId, historyPlan[index].afterId)
end
if playerRateCommit then
  redis.call('HSET', playerRateKey, app.ownershipId, rateNextJson)
end
meta.revision = meta.revision + 1
meta.casToken = app.nextCasToken
redis.call('SET', metaKey, cjson.encode(meta))
redis.call('HSET', evidenceKey, beforeId, beforeJson)
redis.call('HSET', evidenceKey, afterId, afterJson)
redis.call('RPUSH', historyKey, publicationJson)
redis.call('HSET', receiptsKey, app.clientOperationId, receiptJson)
redis.call('RPUSH', outboxKey, publicationJson)
redis.call('HSET', dedupeKey, app.clientOperationId, pendingDedupeJson)
redis.call('RPUSH', dedupeOrderKey, app.clientOperationId)
return {1, result}
`;

export const ROLLKEEPER_CHECKPOINT_LUA_V1 = String.raw`
local app = cjson.decode(ARGV[1])
local controlRaw = redis.call('GET', KEYS[6])
local registryRaw = redis.call('HGET', KEYS[7], app.sceneId)
if not controlRaw or not registryRaw then return {0, 'forbidden'} end
local controlOk, control = pcall(cjson.decode, controlRaw)
local registryOk, registry = pcall(cjson.decode, registryRaw)
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if type(app.deadlineAt) ~= 'number' or app.deadlineAt <= now then return {0,'expired'} end
if not controlOk or not registryOk or control.epoch ~= app.epoch or registry.deleted == true
  or registry.v ~= 1 or registry.roomId ~= app.room or registry.sceneId ~= app.sceneId then return {0,'forbidden'} end
if app.role == 'dm' then
  if control.writerFence ~= app.writerFence or control.leaseUntil <= now then return {0,'forbidden'} end
  if app.principal and control.holderPrincipal ~= app.principal then return {0,'forbidden'} end
elseif app.role == 'player' or app.role == 'display' then
  if type(control.presentation) ~= 'table' or control.presentation.sceneId ~= app.sceneId
    or control.presentation.blanked == true then return {0,'forbidden'} end
  if app.role == 'display' and control.displayGeneration ~= app.displayGeneration then return {0,'forbidden'} end
else return {0,'forbidden'} end
local metaRaw = redis.call('GET', KEYS[1])
if not metaRaw then return {0, 'generation-mismatch'} end
local ok, meta = pcall(cjson.decode, metaRaw)
if not ok or type(meta) ~= 'table' or meta.v ~= 1 or meta.generation ~= app.roomGeneration
  then return {0, 'generation-mismatch'} end
local function values(key)
  local fields = redis.call('HKEYS', key); table.sort(fields); local out = {}
  for _, field in ipairs(fields) do
    local raw = redis.call('HGET', key, field)
    local parsedOk, parsed = pcall(cjson.decode, raw)
    if not parsedOk then return nil end
    out[#out+1] = parsed
  end
  return out
end
local elements, layers, tiles = values(KEYS[2]), values(KEYS[3]), values(KEYS[5])
if not elements or not layers or not tiles then return {0, 'invalid'} end
local fog = cjson.null
local fogRaw = redis.call('HGET', KEYS[4], 'current')
if fogRaw then
  local fogOk, fogMeta = pcall(cjson.decode, fogRaw)
  if not fogOk then return {0, 'invalid'} end
  fog = {meta=fogMeta,tiles=tiles}
elseif #tiles > 0 then return {0, 'invalid'} end
local function json_array(items)
  if #items == 0 then return '[]' end
  return cjson.encode(items)
end
local fogJson = fog == cjson.null and 'null' or '{"meta":' .. cjson.encode(fog.meta)
  .. ',"tiles":' .. json_array(fog.tiles) .. '}'
local stateJson = '{"elements":' .. json_array(elements) .. ',"layers":' .. json_array(layers)
  .. ',"extensions":{"fog":{"pluginName":"fog","version":1,"data":' .. fogJson .. '}}}'
if #stateJson > 20971520 then return {0, 'overloaded'} end
local result = '{"generation":' .. cjson.encode(meta.generation)
  .. ',"revision":' .. cjson.encode(tostring(meta.revision))
  .. ',"casToken":' .. cjson.encode(meta.casToken) .. ',"state":' .. stateJson .. '}'
return {1,result}
`;

export const ROLLKEEPER_PROVISION_LUA_V1 = String.raw`
local expectedTypes = {'string','hash','string','hash','hash','hash','hash','hash',
  'hash','list','hash','list','hash','list','hash','hash'}
for index = 1, #KEYS do
  local actual = redis.call('TYPE', KEYS[index]).ok
  if actual ~= 'none' and actual ~= expectedTypes[index] then return {0,'invalid'} end
end
local appOk, app = pcall(cjson.decode, ARGV[1])
if not appOk or type(app) ~= 'table' then return {0,'invalid'} end
local function exact_keys(value, expected)
  if type(value) ~= 'table' then return false end
  local allowed, count = {}, 0
  for _, key in ipairs(expected) do allowed[key] = true end
  for key, _ in pairs(value) do
    if not allowed[key] then return false end
    count = count + 1
  end
  return count == #expected
end
local function dense_array(value)
  if type(value) ~= 'table' then return false end
  local count = 0
  for key, _ in pairs(value) do
    if type(key) ~= 'number' or key < 1 or key % 1 ~= 0 then return false end
    count = count + 1
  end
  return count == #value
end
local controlRaw = redis.call('GET', KEYS[1])
local registryRaw = redis.call('HGET', KEYS[2], app.sceneId)
if not controlRaw or not registryRaw then return {0,'forbidden'} end
local controlOk, control = pcall(cjson.decode, controlRaw)
local registryOk, registry = pcall(cjson.decode, registryRaw)
if not controlOk or not registryOk or type(control) ~= 'table' or type(registry) ~= 'table'
  then return {0,'invalid'} end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if type(app.deadlineAt) ~= 'number' or app.deadlineAt <= now then return {0,'expired'} end
if control.epoch ~= app.epoch or control.writerFence ~= app.writerFence
  or control.holderPrincipal ~= app.principal or control.leaseUntil <= now
  or registry.deleted == true or registry.sceneId ~= app.sceneId
  or registry.roomId ~= app.room then return {0,'forbidden'} end
local current = redis.call('GET', KEYS[3])
if current then
  local meta = cjson.decode(current)
  if app.expectedGeneration == cjson.null or meta.generation ~= app.expectedGeneration
    or app.expectedCasToken == cjson.null or meta.casToken ~= app.expectedCasToken then
    return {0,'conflict'}
  end
else
  if app.expectedGeneration ~= cjson.null or app.expectedCasToken ~= cjson.null then return {0,'conflict'} end
end
local state = app.state
if not exact_keys(state, {'elements','layers','extensions'})
  or not exact_keys(state.extensions, {'fog'})
  or not exact_keys(state.extensions.fog, {'pluginName','version','data'})
  or not exact_keys(app.stateShape, {'elementsArray','layersArray','fogTilesArray'})
  or app.stateShape.elementsArray ~= true or app.stateShape.layersArray ~= true
  or app.stateShape.fogTilesArray ~= true
  or not dense_array(state.elements) or not dense_array(state.layers)
  or state.extensions.fog.pluginName ~= 'fog' or state.extensions.fog.version ~= 1
  or type(app.generation) ~= 'string' or app.generation == ''
  or type(app.casToken) ~= 'string' or app.casToken == '' then return {0,'invalid'} end
local encodedState = cjson.encode(state)
if #encodedState > 20971520 then return {0,'overloaded'} end
local elementIds, layerIds = {}, {}
for _, element in ipairs(state.elements) do
  if type(element) ~= 'table' or type(element.id) ~= 'string' or element.id == ''
    or elementIds[element.id] then return {0,'invalid'} end
  elementIds[element.id] = true
end
for _, layer in ipairs(state.layers) do
  if type(layer) ~= 'table' or type(layer.id) ~= 'string' or layer.id == ''
    or type(layer.version) ~= 'number' or type(layer.editor) ~= 'string'
    or layerIds[layer.id] then return {0,'invalid'} end
  layerIds[layer.id] = true
end
local fog = state.extensions.fog.data
if fog ~= cjson.null then
  if not exact_keys(fog, {'meta','tiles'}) or type(fog.meta) ~= 'table'
    or not dense_array(fog.tiles) or #fog.tiles > 256 then return {0,'invalid'} end
end
-- All guards and serialization precede the first write. Generation
-- replacement also retires every replay, receipt, history and publication
-- artifact atomically, so no old-generation work can escape afterward.
redis.call('DEL', KEYS[4],KEYS[5],KEYS[6],KEYS[7],KEYS[8],KEYS[9],KEYS[10],
  KEYS[11],KEYS[12],KEYS[13],KEYS[14],KEYS[15],KEYS[16])
for _, element in ipairs(state.elements) do
  redis.call('HSET',KEYS[4],element.id,cjson.encode(element))
  if type(element.ownerId) == 'string' then redis.call('HSET',KEYS[5],element.id,element.ownerId) end
end
for _, layer in ipairs(state.layers) do redis.call('HSET',KEYS[6],layer.id,cjson.encode(layer)) end
if fog ~= cjson.null then
  redis.call('HSET',KEYS[7],'current',cjson.encode(fog.meta))
  for _, tile in ipairs(fog.tiles) do redis.call('HSET',KEYS[8],tostring(tile.x)..','..tostring(tile.y),cjson.encode(tile)) end
end
redis.call('SET',KEYS[3],cjson.encode({v=1,generation=app.generation,revision=0,casToken=app.casToken}))
return {1,app.generation}
`;
