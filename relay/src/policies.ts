import type {
  Authenticate,
  Authorize,
  CanRead,
  OwnedElement,
} from '@fieldnotes/sync-server';
import { verifyBattleMapToken } from './token.js';

export const DM_AUDIENCE = 'dm';

/**
 * The whole security model of the live battle map lives in these three hooks.
 * They run on the relay; clients never see elements canRead filters out.
 */
export function makePolicies(secret: string): {
  authenticate: Authenticate;
  authorize: Authorize;
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
    if (op.kind === 'upsert') {
      const element = op.element as OwnedElement;
      if (element.audience === DM_AUDIENCE) return false; // cannot forge hidden content
      if (currentElement === undefined) return true; // creating their own element
      return currentElement.ownerId === userId;
    }
    if (op.kind === 'remove') {
      return currentElement !== undefined && currentElement.ownerId === userId;
    }
    return true; // request-snapshot / presence
  };

  const canRead: CanRead = ({ role, audience }) =>
    audience !== DM_AUDIENCE || role === 'dm';

  return { authenticate, authorize, canRead };
}
