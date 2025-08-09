use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::states::{AmmConfig, TokenBadge};

#[derive(Accounts)]
pub struct InitializeTokenBadge<'info> {
    pub amm_config: Box<Account<'info, AmmConfig>>,


    #[account(address = amm_config.token_badge_authority)]
    pub token_badge_authority: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(init,
      payer = funder,
      seeds = [
        b"token_badge",
        amm_config.key().as_ref(),
        token_mint.key().as_ref(),
      ],
      bump,
      space = TokenBadge::LEN)]
    pub token_badge: Account<'info, TokenBadge>,

    #[account(mut)]
    pub funder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeTokenBadge>) -> Result<()> {
    ctx.accounts.token_badge.initialize(
        ctx.accounts.amm_config.key(),
        ctx.accounts.token_mint.key(),
    )
}
