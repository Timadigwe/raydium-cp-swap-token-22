use crate::{error::ErrorCode, states::TokenBadge};
use anchor_lang::{prelude::*, solana_program, system_program};
use anchor_spl::{
    token::{Token, TokenAccount},
    token_2022,
    token_interface::{initialize_account3, InitializeAccount3, Mint, TokenInterface, TokenAccount as TokenAccountInterface},
};
use spl_token_2022::{
    self,
    extension::{
        transfer_fee::{TransferFeeConfig, MAX_FEE_BASIS_POINTS},
        BaseStateWithExtensions, ExtensionType, StateWithExtensions,
    },
};
use std::collections::HashSet;

const MINT_WHITELIST: [&'static str; 4] = [
    "HVbpJAQGNpkgBaYBZQBR1t7yFdvaYVp2vCQQfKKEN4tM",
    "Crn4x1Y2HUKko7ox2EZMT6N2t2ZyH7eKtwkBGVnhEq1g",
    "FrBfWJ4qE5sCzKm3k3JaAtqZcXUh4LvJygDeketsrsH4",
    "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
];



// pub fn transfer_from_user_to_pool_vault<'info>(
//     authority: &Signer<'info>,
//     from: &InterfaceAccount<'info, TokenAccountInterface>,
//     to_vault: AccountInfo<'info>,
//     mint: &InterfaceAccount<'info, Mint>,
//     token_program: &Interface<'info, TokenInterface>,
//     amount: u64,
//     mint_decimals: u8,
//     transfer_hook_accounts: &Option<Vec<AccountInfo<'info>>>,
// ) -> Result<()> {
//     msg!("transfer_from_user_to_pool_vault - amount: {}, mint_decimals: {}", amount, mint_decimals);
//     msg!("transfer_from_user_to_pool_vault - transfer_hook_accounts.is_some(): {}", transfer_hook_accounts.is_some());
    
//     if amount == 0 {
//         msg!("transfer_from_user_to_pool_vault - amount is 0, skipping");
//         return Ok(());
//     }
    
//     // Use the appropriate token program based on the mint owner
//     if *mint.to_account_info().owner == token_2022::Token2022::id() {
//         msg!("transfer_from_user_to_pool_vault - using token_2022 program");
//         // token_2022::transfer_checked(
//         //     CpiContext::new(
//         //         token_program.to_account_info(),
//         //         token_2022::TransferChecked {
//         //             from: from.to_account_info(),
//         //             to: to_vault.to_account_info(),
//         //             authority: authority.to_account_info(),
//         //             mint: mint.to_account_info(),
//         //         },
//         //     ),
//         //     amount,
//         //     mint_decimals,
//         // )


//         let mut instruction = spl_token_2022::instruction::transfer_checked(
//             token_program.key,
//             // owner to vault
//             &from.key(), // from (owner account)
//             &mint.key(),          // mint
//             &to_vault.key(),         // to (vault account)
//             authority.key,              // authority (owner)
//             &[],
//             amount,
//             mint_decimals,
//         )?;
    
//         let mut account_infos = vec![
//             token_program.to_account_info(),
//             // owner to vault
//             from.to_account_info(), // from (owner account)
//             mint.to_account_info(),          // mint
//             to_vault.to_account_info(),         // to (vault account)
//             authority.to_account_info(),           // authority (owner)
//         ];

//          // TransferHook extension
//     if let Some(hook_program_id) = get_transfer_hook_program_id(mint)? {
//         if transfer_hook_accounts.is_none() {
//             return Err(ErrorCode::NoExtraAccountsForTransferHook.into());
//         }
//         spl_transfer_hook_interface::onchain::add_extra_accounts_for_execute_cpi(
//             &mut instruction,
//             &mut account_infos,
//             &hook_program_id,
//             // user to vault
//             from.to_account_info(), // from (user account)
//             mint.to_account_info(),          // mint
//             to_vault.to_account_info(),         // to (vault account)
//             authority.to_account_info(),           // authority (owner)
//             amount,
//             transfer_hook_accounts.as_ref().unwrap(),
//         )?;
//     }

//     solana_program::program::invoke_signed(&instruction, &account_infos, &[])?;

//     Ok(())

//     } else {
//         msg!("transfer_from_user_to_pool_vault - using regular SPL token program");
//         // Use regular SPL token program
//         anchor_spl::token::transfer(
//             CpiContext::new(
//                 token_program.to_account_info(),
//                 anchor_spl::token::Transfer {
//                     from: from.to_account_info(),
//                     to: to_vault.to_account_info(),
//                     authority: authority.to_account_info(),
//                 },
//             ),
//             amount,
//         )
//     }
// }









pub fn verify_supported_token_mint(
    token_mint: &InterfaceAccount<'_, Mint>,
    amm_config_key: Pubkey,
    token_badge: &UncheckedAccount<'_>,
) -> Result<bool> {
    let token_badge_initialized =
        is_token_badge_initialized(amm_config_key, token_mint.key(), token_badge)?;

    let is_supported = is_supported_token_mint(token_mint, token_badge_initialized)?;
    
    Ok(is_supported)
}

pub fn is_token_badge_initialized(
    amm_config_key: Pubkey,
    token_mint_key: Pubkey,
    token_badge: &UncheckedAccount<'_>,
) -> Result<bool> {
    if *token_badge.owner != crate::id() {
        return Ok(false);
    }

    let token_badge = TokenBadge::try_deserialize(&mut token_badge.data.borrow().as_ref())?;

    Ok(token_badge.amm_config == amm_config_key
        && token_badge.token_mint == token_mint_key)
}


pub fn is_supported_token_mint(mint_account: &InterfaceAccount<Mint>, token_badge_initialized: bool) -> Result<bool> {
    let mint_info = mint_account.to_account_info();
    if *mint_info.owner == Token::id() {
        msg!("is_supported_mint: Regular SPL token, supported");
        return Ok(true);
    }

     // reject native mint of Token-2022 Program to avoid SOL liquidity fragmentation
     if spl_token_2022::native_mint::check_id(&mint_account.key()) {
        return Ok(false);
    }

     // reject if mint has freeze_authority
     if mint_account.freeze_authority.is_some() && !token_badge_initialized {
        return Ok(false);
    }

    let mint_whitelist: HashSet<&str> = MINT_WHITELIST.into_iter().collect();
    if mint_whitelist.contains(mint_account.key().to_string().as_str()) {
        msg!("is_supported_mint: Mint in whitelist, supported");
        return Ok(true);
    }
    let mint_data = mint_info.try_borrow_data()?;
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;
    let extensions = mint.get_extension_types()?;
    
    msg!("is_supported_mint: Checking Token-2022 mint with extensions: {:?}", extensions);
    
    for extension in extensions {
        msg!("is_supported_mint: Checking extension: {:?}", extension);
        match extension {
            // Supported extensions
            ExtensionType::TransferFeeConfig => {}
            ExtensionType::InterestBearingConfig => {}
            ExtensionType::TokenMetadata => {}
            ExtensionType::MetadataPointer => {}
            ExtensionType::ScaledUiAmount => {}
            
            // Partially supported extensions (non-confidential transfer only)
            ExtensionType::ConfidentialTransferMint => {
                // Supported, but non-confidential transfer only
                // WhirlpoolProgram invokes TransferChecked instruction and it supports non-confidential transfer only.
                // Because the vault accounts are not configured to support confidential transfer,
                // it is impossible to send tokens directly to the vault accounts confidentially.
            }
            ExtensionType::ConfidentialTransferFeeConfig => {
                // Supported, but non-confidential transfer only
                // When both TransferFeeConfig and ConfidentialTransferMint are initialized,
                // ConfidentialTransferFeeConfig is also initialized to store encrypted transfer fee amount.
            }
            
            // Supported if token badge is initialized
            ExtensionType::PermanentDelegate => {
                if !token_badge_initialized {
                    msg!("is_supported_mint: PermanentDelegate requires token badge initialization");
                    return Ok(false);
                }
            }
            ExtensionType::TransferHook => {
                if !token_badge_initialized {
                    msg!("is_supported_mint: TransferHook requires token badge initialization");
                    return Ok(false);
                }
            }
            ExtensionType::MintCloseAuthority => {
                if !token_badge_initialized {
                    msg!("is_supported_mint: MintCloseAuthority requires token badge initialization");
                    return Ok(false);
                }
            }
            ExtensionType::DefaultAccountState => {
                if !token_badge_initialized {
                    msg!("is_supported_mint: DefaultAccountState requires token badge initialization");
                    return Ok(false);
                }
            }
            ExtensionType::Pausable => {
                if !token_badge_initialized {
                    msg!("is_supported_mint: Pausable requires token badge initialization");
                    return Ok(false);
                }
            }
            
            // No possibility to support the following extensions
            ExtensionType::NonTransferable => {
                msg!("is_supported_mint: NonTransferable extension not supported");
                return Ok(false);
            }
            
            // Mint has unknown or unsupported extensions
            _ => {
                msg!("is_supported_mint: Unknown or unsupported extension: {:?}", extension);
                return Ok(false);
            }
        }
    }
    
    msg!("is_supported_mint: All extensions supported");
    Ok(true)
}



