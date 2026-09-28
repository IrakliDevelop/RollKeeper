/** All control, registry, ledger and compatibility writes share one Redis transaction. */
export const TABLE_CONTROL_SCRIPT = `
local controlKey, registryKey, ledgerKey, orderKey, initiativeKey, battlemapKey, requestKey = unpack(KEYS)
local cmd = cjson.decode(ARGV[1])
local digest, principal, epoch, roomId = ARGV[2], ARGV[3], ARGV[4], ARGV[5]
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local ttl = 86400
local raw = redis.call('GET', controlKey)
local state = nil
if raw then
  local ok, parsed = pcall(cjson.decode, raw)
  if not ok or type(parsed) ~= 'table' or parsed.v ~= 1 then
    return cjson.encode({status='unavailable', reason='invalid-control'})
  end
  state = parsed
end
local function descriptor()
  if not state then return cjson.null end
  return {epoch=state.epoch, revision=state.revision, writerFence=state.writerFence,
    leaseUntil=state.leaseUntil, holderSessionId=state.holderSessionId,
    presentation={sceneId=state.presentation.sceneId, revision=state.presentation.revision,
      blanked=state.presentation.blanked}, publicRunId=state.publicRunId}
end
local function reply(status, reason, extra)
  local result = {status=status, reason=reason, current=descriptor()}
  if extra then for key,value in pairs(extra) do result[key]=value end end
  return cjson.encode(result)
end
if not state and cmd.type ~= 'initialize' then return reply('conflict','missing-control') end
if state and cmd.type ~= 'initialize' and cmd.expectedEpoch ~= state.epoch then
  return reply('conflict','stale-epoch')
end
local old = redis.call('HGET', ledgerKey, cmd.operationId)
if old then
  local saved = cjson.decode(old)
  if saved.expiresAt <= now then
    redis.call('HDEL', ledgerKey, cmd.operationId)
    redis.call('LREM', orderKey, 0, cmd.operationId)
  elseif not state or saved.epoch ~= state.epoch then
    return reply('conflict','stale-epoch')
  else
  if saved.digest ~= digest then return reply('conflict','operation-id-reused') end
  return reply('committed', 'duplicate', {historical=not state or state.revision ~= saved.revision,
    committedRevision=saved.revision})
  end
end
local function record()
  redis.call('SET', controlKey, cjson.encode(state), 'EX', ttl)
  redis.call('EXPIRE', registryKey, ttl)
  redis.call('HSET', ledgerKey, cmd.operationId, cjson.encode({digest=digest,
    epoch=state.epoch, revision=state.revision, expiresAt=now+86400000}))
  redis.call('RPUSH', orderKey, cmd.operationId)
  if redis.call('LLEN', orderKey) > 256 then
    local evicted = redis.call('LPOP', orderKey)
    redis.call('HDEL', ledgerKey, evicted)
  end
  redis.call('EXPIRE', ledgerKey, ttl)
  redis.call('EXPIRE', orderKey, ttl)
  return reply('committed','current',{historical=false, committedRevision=state.revision})
end
if cmd.type == 'initialize' then
  if state then return reply('conflict','already-initialized') end
  state = {v=1, epoch=epoch, revision=0, writerFence=0, holderSessionId=cjson.null,
    holderPrincipal=cjson.null, leaseUntil=0, presentation={sceneId=cjson.null,
      revision=0, blanked=false}, publicRunId=cjson.null, displayGeneration=0,
      displayCapabilityHash=cjson.null}
  redis.call('DEL', initiativeKey, requestKey)
  redis.call('SET', battlemapKey, cjson.encode({activeBattleMapId=cjson.null,
    updatedAt=now}), 'EX', ttl)
  return record()
end
if cmd.expectedEpoch ~= state.epoch or cmd.expectedRevision ~= state.revision then
  return reply('conflict','stale-control')
end
if cmd.expectedFence ~= state.writerFence then return reply('conflict','stale-fence') end
local leaseActive = tonumber(state.leaseUntil) > now
local owns = leaseActive and state.holderSessionId == cmd.holderSessionId and
  state.holderPrincipal == principal and state.writerFence == cmd.expectedFence
if cmd.type == 'acquire' then
  if leaseActive then return reply('conflict','controller-active') end
  state.writerFence = state.writerFence + 1
  state.holderSessionId = cmd.holderSessionId
  state.holderPrincipal = principal
  state.leaseUntil = now + 30000
  state.publicRunId = cjson.null
  redis.call('DEL', initiativeKey, requestKey)
elseif cmd.type == 'takeover' then
  state.writerFence = state.writerFence + 1
  state.adoptionFence = state.writerFence
  state.holderSessionId = cmd.holderSessionId
  state.holderPrincipal = principal
  state.leaseUntil = now + 30000
  state.publicRunId = cjson.null
  redis.call('DEL', initiativeKey, requestKey)
elseif cmd.type == 'renew' then
  if not owns then return reply('conflict','lease-lost') end
  state.leaseUntil = now + 30000
  local initiative = redis.call('GET', initiativeKey)
  if initiative then
    local ok, parsed = pcall(cjson.decode, initiative)
    if ok and type(parsed) == 'table' and parsed.isActive then
      parsed.expiresAt = state.leaseUntil
      redis.call('SET', initiativeKey, cjson.encode(parsed), 'EX', ttl)
    end
  end
else
  if not owns then return reply('conflict','lease-lost') end
  if cmd.type == 'registerScene' or cmd.type == 'updateScene' then
    local previous = redis.call('HGET', registryKey, cmd.sceneId)
    local existing = previous and cjson.decode(previous) or nil
    if cmd.type == 'registerScene' and existing then
      if existing.workspaceInstanceId ~= cmd.workspaceInstanceId or
        existing.sourceMapId ~= cmd.sourceMapId or existing.deleted then
        return reply('conflict','scene-already-registered')
      end
    end
    if cmd.type == 'updateScene' and (not existing or existing.deleted or
      existing.workspaceInstanceId ~= cmd.workspaceInstanceId or
      existing.sourceMapId ~= cmd.sourceMapId) then
      return reply('conflict','scene-identity-mismatch')
    end
    local registryRevision = existing and existing.registryRevision or 0
    if cmd.expectedRegistryRevision ~= registryRevision then
      return reply('conflict','stale-registry')
    end
    if not existing and redis.call('HLEN', registryKey) >= 100 then
      return reply('denied','registry-full')
    end
    local entry = {v=1, sceneId=cmd.sceneId, workspaceInstanceId=cmd.workspaceInstanceId,
      sourceMapId=cmd.sourceMapId, contentRevision=cmd.contentRevision,
      safeLabel=cmd.safeLabel, registeredAt=existing and existing.registeredAt or now,
      registryRevision=registryRevision+1, deleted=false,
      roomId=existing and existing.roomId or roomId}
    local encoded = cjson.encode(entry)
    if string.len(encoded) > 2048 then return reply('denied','entry-too-large') end
    redis.call('HSET', registryKey, cmd.sceneId, encoded)
  elseif cmd.type == 'adoptScene' then
    if state.adoptionFence ~= state.writerFence then
      return reply('denied','takeover-required')
    end
    local rawEntry = redis.call('HGET', registryKey, cmd.sceneId)
    if not rawEntry then return reply('conflict','scene-unregistered') end
    local entry = cjson.decode(rawEntry)
    if entry.deleted or cmd.expectedRegistryRevision ~= entry.registryRevision then
      return reply('conflict','stale-registry')
    end
    entry.workspaceInstanceId = cmd.workspaceInstanceId
    entry.registryRevision = entry.registryRevision + 1
    redis.call('HSET', registryKey, cmd.sceneId, cjson.encode(entry))
  elseif cmd.type == 'tombstoneScene' or cmd.type == 'deletePresented' then
    local sceneId = cmd.sceneId
    if cmd.type == 'deletePresented' then sceneId = state.presentation.sceneId end
    if sceneId == cjson.null then return reply('conflict','no-presented-scene') end
    local rawEntry = redis.call('HGET', registryKey, sceneId)
    if not rawEntry then return reply('conflict','scene-unregistered') end
    local entry = cjson.decode(rawEntry)
    if cmd.type == 'tombstoneScene' and cmd.expectedRegistryRevision ~= entry.registryRevision then
      return reply('conflict','stale-registry')
    end
    entry.deleted = true
    entry.registryRevision = entry.registryRevision + 1
    redis.call('HSET', registryKey, sceneId, cjson.encode(entry))
    if state.presentation.sceneId == sceneId then
      state.presentation.sceneId = cjson.null
      state.presentation.blanked = false
      state.presentation.revision = state.presentation.revision + 1
    end
  elseif cmd.type == 'show' then
    local rawEntry = redis.call('HGET', registryKey, cmd.sceneId)
    if not rawEntry then return reply('conflict','scene-unregistered') end
    local entry = cjson.decode(rawEntry)
    if entry.deleted then return reply('conflict','scene-deleted') end
    state.presentation.sceneId = cmd.sceneId
    state.presentation.blanked = false
    state.presentation.revision = state.presentation.revision + 1
  elseif cmd.type == 'blank' then
    state.presentation.blanked = true
    state.presentation.revision = state.presentation.revision + 1
  elseif cmd.type == 'unpresent' then
    state.presentation.sceneId = cjson.null
    state.presentation.blanked = false
    state.presentation.revision = state.presentation.revision + 1
  elseif cmd.type == 'publishInitiative' then
    local initiative = cmd.initiative
    initiative.expiresAt = state.leaseUntil
    redis.call('SET', initiativeKey, cjson.encode(initiative), 'EX', ttl)
    state.publicRunId = cmd.runId
  elseif cmd.type == 'publishInitiativeRequest' then
    if cmd.request == cjson.null then
      redis.call('DEL', requestKey)
    else
      redis.call('SET', requestKey, cjson.encode(cmd.request), 'EX', ttl)
    end
  elseif cmd.type == 'endInitiative' then
    redis.call('DEL', initiativeKey)
    state.publicRunId = cjson.null
  else
    return reply('denied','unknown-command')
  end
end
state.revision = state.revision + 1
-- PR04 read guards are not installed. Never project a scene/source map ID publicly.
redis.call('SET', battlemapKey, cjson.encode({activeBattleMapId=cjson.null,
  updatedAt=now}), 'EX', ttl)
return record()
`;
