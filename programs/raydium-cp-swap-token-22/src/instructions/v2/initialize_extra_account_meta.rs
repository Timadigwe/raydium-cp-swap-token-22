use anchor_lang::{
    prelude::*,
    solana_program::{instruction::Instruction, program::invoke}
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump,
        seeds::program = transfer_hook_program.key()
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: The transfer hook program (needed for PDA derivation)
    pub transfer_hook_program: UncheckedAccount<'info>,
}

pub fn initialize_extra_account_meta(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
   
    // Use the exact discriminator from the IDL
    let discriminator: [u8; 8] = [92, 197, 174, 197, 41, 124, 19, 3];

    let accounts = vec![
        AccountMeta::new(ctx.accounts.payer.key(), true),
        AccountMeta::new(ctx.accounts.extra_account_meta_list.key(), false),
        AccountMeta::new_readonly(ctx.accounts.mint.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
    ];

    let instruction = Instruction {
        program_id: ctx.accounts.transfer_hook_program.key(),
        accounts,
        data: discriminator.to_vec(),
    };

    let account_infos = vec![
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.extra_account_meta_list.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.associated_token_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.transfer_hook_program.to_account_info(),
    ];

    invoke(&instruction, &account_infos)?;

    msg!("Successfully initialized extra account meta list via CPI");
    Ok(())
}
