create index campaigns_owner_id_idx
  on public.campaigns (owner_id);

create index campaign_workspace_claim_provenance_claimant_id_idx
  on public.campaign_workspace_claim_provenance (claimant_id);

create index campaign_workspace_claim_provenance_authorization_id_idx
  on public.campaign_workspace_claim_provenance (authorization_id);

create index campaign_mutation_receipts_campaign_id_idx
  on private.campaign_mutation_receipts (campaign_id);
