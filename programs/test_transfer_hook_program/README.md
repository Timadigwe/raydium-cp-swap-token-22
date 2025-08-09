# Test Transfer Hook Program

A reference implementation of a Token-2022 Transfer Hook program for testing and demonstration purposes within the **Raydium CP Swap AMM ecosystem**. This program serves as an example of how to implement a safe and compliant transfer hook that works seamlessly with Raydium's AMM implementation that fully supports transfer hook-enabled tokens.

## Overview

This project consists of two main components:

### 1. **Raydium CP Swap AMM with Transfer Hook Support**
The main AMM program (`raydium_cp_swap_token_22`) provides a complete constant product swap implementation with native support for:
- **Token-2022 Transfer Hooks**: Full integration with transfer hook-enabled tokens
- **TokenBadge System**: Whitelisting mechanism for transfer hook tokens
- **V2 Pool Creation**: Enhanced pool initialization for hook-enabled tokens
- **Seamless Operations**: Swap, deposit, withdraw operations work transparently with transfer hooks
- **Additional Account Management**: Handles extra accounts required by transfer hooks

### 2. **Test Transfer Hook Program** (This Program)
This transfer hook program demonstrates a minimal, safe implementation that:
- Logs token transfers
- Maintains a transfer counter
- Validates transfer hook execution context
- Does not interfere with AMM pool operations
- Follows TokenBadge best practices for eligibility

## Program IDs

## Raydium CP Swap AMM
**Localnet**: `HJP61gQgQTzTkT7eXfz3WCzfiF2KmPhVWE2e4Yjc4VLT`
**Devnet**: `HJP61gQgQTzTkT7eXfz3WCzfiF2KmPhVWE2e4Yjc4VLT`



## Features

### ✅ TokenBadge Best Practices Compliance

This program adheres to the recommended best practices for TokenBadge eligibility:

- **📖 Publicly Available Code**: Source code is open and transparent
- **🔒 Safe Operations**: Only performs logging operations with no risk to users
- **🚫 Non-Blocking**: Does not block token transfers or interfere with pool operations
- **⚡ Minimal Account Usage**: Uses minimal extra accounts to avoid transaction bloat
- **💰 No Additional Fees**: Does not impose any fees on transfers
- **🔄 No Token Transfers**: Does not attempt any token transfers itself

### Core Functionality

1. **Transfer Logging**: Logs each transfer with amount and counter information
2. **Transfer Counting**: Maintains a global counter of transfers for the token
3. **Validation**: Ensures the hook is only called during valid transfer contexts
4. **Example Warning**: Demonstrates logging for transfers over 50 tokens (without blocking)

## Instructions

### `initialize_extra_account_meta_list`

Initializes the extra account metadata list required for the transfer hook.

**Accounts:**
- `payer`: Signer paying for account creation
- `extra_account_meta_list`: PDA storing extra account metadata
- `mint`: The token mint this hook applies to
- `counter_account`: PDA storing the transfer counter
- `token_program`: Token2022 program
- `associated_token_program`: Associated Token program
- `system_program`: System program

### `transfer_hook`

Executed on every token transfer, performing logging and validation.

**Parameters:**
- `amount`: The amount of tokens being transferred

**Accounts:**
- `source_token`: Source token account
- `mint`: Token mint
- `destination_token`: Destination token account
- `owner`: Token account owner
- `extra_account_meta_list`: Extra account metadata PDA
- `counter_account`: Transfer counter PDA

## Implementation Details

### Account Structure

```rust
#[account]
pub struct CounterAccount {
    counter: u64,
}
```

### Error Handling

The program defines custom errors for validation:
- `AmountTooBig`: Used for demonstration (currently unused)
- `IsNotCurrentlyTransferring`: Ensures hook execution context is valid

### Extra Account Metadata

The program requires one extra account:
- Counter account PDA (seeds: `[b"counter"]`)

## Raydium AMM Transfer Hook Integration

### TokenBadge System
The Raydium AMM implements a **TokenBadge** system that enables controlled support for transfer hook tokens:

- **Whitelisting**: Each AMM config can independently whitelist transfer hook tokens by issuing TokenBadge accounts
- **Authority Control**: Only the `token_badge_authority` of an AMM config can create TokenBadges
- **Pool Creation**: Tokens with transfer hooks require a valid TokenBadge to create pools
- **Seamless Trading**: Once whitelisted, tokens work transparently in all AMM operations

### V2 Pool Support
The AMM provides enhanced V2 instructions specifically designed for transfer hook compatibility:

```rust
// V2 pool initialization with transfer hook support
pub fn initialize_v2(
    ctx: Context<InitializeV2>,
    init_amount_0: u64,
    init_amount_1: u64,
    open_time: u64,
) -> Result<()>

// Token badge creation for transfer hook tokens
pub fn initialize_token_badge(ctx: Context<InitializeTokenBadge>) -> Result<()>

// Extra account metadata initialization for transfer hooks
pub fn initialize_extra_account_meta_list(
    ctx: Context<InitializeExtraAccountMetaList>,
) -> Result<()>
```

### Transfer Hook Integration
The AMM handles transfer hook complexities automatically:

- **Additional Accounts**: Manages extra accounts required by transfer hooks
- **CPI Integration**: Uses `add_extra_accounts_for_execute_cpi` for proper hook execution
- **Account Type Management**: Supports various transfer hook account types (input, output, intermediate)
- **Transaction Optimization**: Efficiently handles increased transaction size from hook accounts

## Usage in Tests

This program is used in the Raydium CP Swap test suite to verify:
- Transfer hook compatibility with AMM operations
- TokenBadge system functionality
- V2 pool creation with hook-enabled tokens
- Swap, deposit, and withdraw operations with transfer hooks
- Transaction size and performance impact
- End-to-end integration testing

## Safety Features

### Transfer Context Validation

```rust
fn check_is_transferring(ctx: &Context<TransferHook>) -> Result<()> {
    // Validates that the hook is called from within a valid transfer
    let source_token_info = ctx.accounts.source_token.to_account_info();
    let mut account_data_ref = source_token_info.try_borrow_mut_data()?;
    let mut account = PodStateWithExtensionsMut::<PodAccount>::unpack(*account_data_ref)?;
    let account_extension = account.get_extension_mut::<TransferHookAccount>()?;

    if !bool::from(account_extension.transferring) {
        return err!(TransferError::IsNotCurrentlyTransferring);
    }

    Ok(())
}
```

### Safe Counter Increment

```rust
// Increment the transfer count safely
let count = ctx.accounts.counter_account.counter
    .checked_add(1)
    .ok_or(TransferError::AmountTooBig)?;
```

## Building and Testing

### Prerequisites

- Rust 1.70+
- Solana CLI tools
- Anchor Framework 0.31.1+

### Build

```bash
# From project root
anchor build
```

### Test

```bash
# Run the full test suite including transfer hook tests
anchor test

# Or run specific transfer hook tests
yarn test tests/initializev2.test.ts
```

## Integration Example

### 1. Creating a Transfer Hook Token for AMM Use

```typescript
// 1. Create a token with transfer hook extension
const transferHookProgramId = new PublicKey("HEngeJQLoaujgA44QRLCMVtDWKcx8mvhQErfRgKXGQKs");
const hookMint = await createMintWithTransferHook(
  connection,
  payer,
  authority,
  mintKeypair,
  transferHookProgramId
);

// 2. Initialize extra account metadata for the token
await transferHookProgram.methods
  .initializeExtraAccountMetaList()
  .accounts({
    payer: payer.publicKey,
    extraAccountMetaList: extraAccountMetaListPda,
    mint: hookMint.publicKey,
    counterAccount: counterPda,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([payer])
  .rpc();

// 3. Create TokenBadge to whitelist the token for AMM use
const tokenBadgeAddress = await createTokenBadge(
  ammProgram,
  connection,
  tokenBadgeAuthority,
  funder,
  ammConfigAddress,
  hookMint.publicKey
);

// 4. Create AMM pool using V2 instruction (supports transfer hooks)
await ammProgram.methods
  .initializeV2(initAmount0, initAmount1, openTime)
  .accountsStrict({
    creator: creator.publicKey,
    ammConfig: ammConfigAddress,
    poolState: poolAddress,
    token0Mint: hookMint.publicKey,
    token1Mint: otherTokenMint,
    // ... other accounts
    token0Badge: tokenBadgeAddress, // TokenBadge for hook token
    token1Badge: PublicKey.default, // No badge needed for regular token
  })
  .remainingAccounts(transferHookAccounts) // Additional accounts for hooks
  .signers([creator])
  .rpc();
```

### 2. Trading with Transfer Hook Tokens

```typescript
// Swaps work transparently once the pool is created
await ammProgram.methods
  .swapBaseInput(amountIn, minimumAmountOut)
  .accountsStrict({
    payer: trader.publicKey,
    ammConfig: ammConfigAddress,
    poolState: poolAddress,
    inputTokenAccount: traderHookTokenAccount,
    outputTokenAccount: traderOtherTokenAccount,
    // ... vault accounts
  })
  .remainingAccounts(transferHookAccounts) // Hook accounts handled automatically
  .signers([trader])
  .rpc();
```

## Security Considerations

- The program only reads from token accounts and maintains its own state
- No token transfers are initiated by the hook
- No fees are collected or imposed
- Validation ensures proper execution context
- Overflow protection on counter increments

## License

This program is part of the Raydium CP Swap project and follows the same licensing terms.

## Architecture Benefits

This implementation demonstrates several key advantages:

### 1. **Separation of Concerns**
- **AMM Core Logic**: Focused on trading mathematics and pool management
- **Transfer Hook Logic**: Isolated token-specific behavior
- **TokenBadge System**: Controlled onboarding of new token types

### 2. **Scalability**
- **Modular Design**: New transfer hooks can be added without AMM changes
- **Config-Based Control**: Multiple AMM configs can have different token policies
- **Efficient Account Management**: Minimal additional accounts required

### 3. **Developer Experience**
- **Clear Integration Path**: Well-defined steps for adding transfer hook support
- **Comprehensive Testing**: Full test suite covering all scenarios
- **Reference Implementation**: This hook serves as a template for safe implementations

## Contributing

This is a reference implementation for testing purposes. For production transfer hooks, ensure:
- Thorough security audits
- Proper access controls
- Comprehensive testing
- Clear documentation of any transfer restrictions
- Compliance with TokenBadge best practices
- Integration testing with AMM operations
