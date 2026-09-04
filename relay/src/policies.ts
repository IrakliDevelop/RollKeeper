import type {
  Authenticate,
  Authorize,
  AuthorizeFog,
  AuthorizeLayer,
  CanRead,
  OwnedElement,
} from '@fieldnotes/sync-server';
import { verifyBattleMapToken } from './token.js';

export const DM_AUDIENCE = 'dm';

/**
 * The whole security model of the live battle map lives in these hooks.
 * They run on the relay; clients never see elements canRead filters out.
 * Layer definitions are presentation-only (never element bytes), so
 * authorizeLayer guards edit ownership, not privacy.
 */
export function makePolicies(secret: string): {
  authenticate: Authenticate;
  authorize: Authorize;
  authorizeFog: AuthorizeFog;
  authorizeLayer: AuthorizeLayer;
  canRead: CanRead;
} {
  const authenticate: Authenticate = ({ req, room }) => {
    const url = new URL(req.url ?? '', 'http://relay');
    const token = url.searchParams.get('token');
    if (!token) return null;
    const payload = verifyBattleMapToken(token, secret);
    if (!payload || payload.room !== room) return null;
    return { userId: payload.userId, role: payload.role };
  };

  const authorize: Authorize = ({ role, userId, op, currentElement }) => {
    if (role === 'dm') return true;
    if (role !== 'player') return false; // display and anything unexpected: read-only
    if (op.kind === 'clear') return false;
    // A DM-hidden element is untouchable by players regardless of ownership:
    // otherwise a player could reveal (upsert without the audience field,
    // which overwrites it) or delete content the DM has hidden.
    const hidden = currentElement?.audience === DM_AUDIENCE;
    if (op.kind === 'upsert') {
      if (hidden) return false;
      const element = op.element as OwnedElement;
      if (element.audience === DM_AUDIENCE) return false; // cannot forge hidden content
      if (currentElement === undefined) return true; // creating their own element
      return currentElement.ownerId === userId;
    }
    if (op.kind === 'remove') {
      if (hidden) return false;
      return currentElement !== undefined && currentElement.ownerId === userId;
    }
    // The hub only invokes authorize for upsert/remove/clear
    // (request-snapshot and presence are handled before it is called —
    // verified in @fieldnotes/sync-server dist). Fail closed so any future
    // mutating op kind is denied for players until explicitly allowed.
    return false;
  };

  const canRead: CanRead = ({ role, audience }) =>
    audience !== DM_AUDIENCE || role === 'dm';

  // The DM owns the scene; a player may only define/edit their own
  // player-<characterId> layer; the display is read-only. A denied edit is
  // answered by the hub with an authoritative correction to the sender.
  const authorizeLayer: AuthorizeLayer = ({ role, userId, op }) => {
    if (role === 'dm') return true;
    if (role !== 'player') return false;
    const layerId = op.kind === 'layer-upsert' ? op.layer.id : op.id;
    return userId !== undefined && layerId === `player-${userId}`;
  };

  const authorizeFog: AuthorizeFog = ({ role, userId }) =>
    role === 'dm' && typeof userId === 'string' && userId.length > 0;

  return { authenticate, authorize, authorizeFog, authorizeLayer, canRead };
}
