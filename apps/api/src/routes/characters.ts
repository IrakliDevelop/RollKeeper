import { Router, Response } from 'express';
import { authMiddleware, requireCampaignAccess } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, ErrorResponses } from '../utils/response';
import { AuthRequest, SyncCharacterBody } from '../types';
import * as characterService from '../services/character.service';

const router = Router();

/**
 * POST /api/campaigns/:id/characters/sync
 * Sync (upsert) a character snapshot to a campaign
 */
router.post(
  '/:id/characters/sync',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { character_id, character_snapshot } = req.body as SyncCharacterBody;

    if (!character_id || !character_snapshot) {
      return ErrorResponses.validation(res, {
        message: 'character_id and character_snapshot are required',
      });
    }

    const ref = await characterService.syncCharacter(
      req.params.id,
      req.user!.id,
      character_id,
      character_snapshot
    );

    sendSuccess(res, { character_reference: ref });
  })
);

/**
 * GET /api/campaigns/:id/characters
 * Get all character summaries for a campaign (for DM dashboard quick view)
 */
router.get(
  '/:id/characters',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const summaries = await characterService.getCampaignCharacterSummaries(
      req.params.id
    );
    sendSuccess(res, { characters: summaries });
  })
);

/**
 * GET /api/campaigns/:id/characters/:characterId
 * Get full character snapshot (for drill-down view)
 */
router.get(
  '/:id/characters/:characterId',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const character = await characterService.getCharacterSnapshot(
      req.params.id,
      req.params.characterId
    );

    if (!character) {
      return ErrorResponses.notFound(
        res,
        'Character not found in this campaign'
      );
    }

    sendSuccess(res, { character });
  })
);

/**
 * DELETE /api/campaigns/:id/characters/:characterId
 * Remove a character from the campaign
 */
router.delete(
  '/:id/characters/:characterId',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const removed = await characterService.removeCharacterFromCampaign(
      req.params.id,
      req.params.characterId
    );

    if (!removed) {
      return ErrorResponses.notFound(res, 'Character not found');
    }

    sendSuccess(res, { message: 'Character removed from campaign' });
  })
);

export default router;
