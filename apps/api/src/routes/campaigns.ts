import { Router, Response } from 'express';
import {
  authMiddleware,
  requireCampaignDm,
  requireCampaignAccess,
} from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, ErrorResponses } from '../utils/response';
import { AuthRequest, CreateCampaignBody, JoinCampaignBody } from '../types';
import * as campaignService from '../services/campaign.service';

const router = Router();

/**
 * GET /api/campaigns
 * List all campaigns for the authenticated user (as DM or player)
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const campaigns = await campaignService.listCampaignsForUser(req.user!.id);
    sendSuccess(res, { campaigns });
  })
);

/**
 * POST /api/campaigns
 * Create a new campaign (authenticated user becomes the DM)
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, settings } = req.body as CreateCampaignBody;

    if (!name || name.trim().length === 0) {
      return ErrorResponses.validation(res, {
        message: 'Campaign name is required',
      });
    }

    const campaign = await campaignService.createCampaign(
      req.user!.id,
      name.trim(),
      description?.trim(),
      settings
    );

    sendSuccess(res, { campaign }, 201);
  })
);

/**
 * GET /api/campaigns/:id
 * Get campaign details (DM or member)
 */
router.get(
  '/:id',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const campaign = await campaignService.getCampaignById(req.params.id);

    if (!campaign) {
      return ErrorResponses.notFound(res, 'Campaign not found');
    }

    const members = await campaignService.listCampaignMembers(req.params.id);
    const isDm = campaign.dm_id === req.user!.id;

    sendSuccess(res, { campaign, members, isDm });
  })
);

/**
 * PUT /api/campaigns/:id
 * Update a campaign (DM only)
 */
router.put(
  '/:id',
  authMiddleware,
  requireCampaignDm,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, settings, status, current_day } = req.body;

    const campaign = await campaignService.updateCampaign(req.params.id, {
      name,
      description,
      settings,
      status,
      current_day,
    });

    if (!campaign) {
      return ErrorResponses.notFound(res, 'Campaign not found');
    }

    sendSuccess(res, { campaign });
  })
);

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign (DM only)
 */
router.delete(
  '/:id',
  authMiddleware,
  requireCampaignDm,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const deleted = await campaignService.deleteCampaign(req.params.id);

    if (!deleted) {
      return ErrorResponses.notFound(res, 'Campaign not found');
    }

    sendSuccess(res, { message: 'Campaign deleted' });
  })
);

/**
 * POST /api/campaigns/join
 * Join a campaign using an invite code
 */
router.post(
  '/join',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { invite_code } = req.body as JoinCampaignBody;

    if (!invite_code || invite_code.trim().length === 0) {
      return ErrorResponses.validation(res, {
        message: 'Invite code is required',
      });
    }

    const campaign = await campaignService.getCampaignByInviteCode(
      invite_code.trim()
    );

    if (!campaign) {
      return ErrorResponses.notFound(
        res,
        'No active campaign found with that invite code'
      );
    }

    // Don't let DM join their own campaign as a player
    if (campaign.dm_id === req.user!.id) {
      return ErrorResponses.validation(res, {
        message: 'You are already the DM of this campaign',
      });
    }

    const member = await campaignService.joinCampaign(
      campaign.id,
      req.user!.id
    );

    sendSuccess(res, { campaign, member }, 201);
  })
);

/**
 * POST /api/campaigns/:id/leave
 * Leave a campaign (player)
 */
router.post(
  '/:id/leave',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const campaign = await campaignService.getCampaignById(req.params.id);

    if (!campaign) {
      return ErrorResponses.notFound(res, 'Campaign not found');
    }

    if (campaign.dm_id === req.user!.id) {
      return ErrorResponses.validation(res, {
        message: 'DM cannot leave their own campaign. Delete it instead.',
      });
    }

    await campaignService.leaveCampaign(req.params.id, req.user!.id);
    sendSuccess(res, { message: 'Left campaign' });
  })
);

/**
 * GET /api/campaigns/:id/members
 * List campaign members (DM or member)
 */
router.get(
  '/:id/members',
  authMiddleware,
  requireCampaignAccess,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const members = await campaignService.listCampaignMembers(req.params.id);
    sendSuccess(res, { members });
  })
);

/**
 * DELETE /api/campaigns/:id/members/:userId
 * Remove a member from the campaign (DM only)
 */
router.delete(
  '/:id/members/:userId',
  authMiddleware,
  requireCampaignDm,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const removed = await campaignService.removeMember(
      req.params.id,
      req.params.userId
    );

    if (!removed) {
      return ErrorResponses.notFound(res, 'Member not found');
    }

    sendSuccess(res, { message: 'Member removed' });
  })
);

/**
 * POST /api/campaigns/:id/regenerate-code
 * Regenerate the invite code (DM only)
 */
router.post(
  '/:id/regenerate-code',
  authMiddleware,
  requireCampaignDm,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const newCode = await campaignService.regenerateInviteCode(req.params.id);
    sendSuccess(res, { invite_code: newCode });
  })
);

export default router;
