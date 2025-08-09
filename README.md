# Raydium CP Swap with Token-2022 Transfer Hook Support

A **Raydium AMM implementation** extending the constant product swap model to fully support **Token-2022 tokens with Transfer Hooks**. This project demonstrates how to build a production-ready AMM that can safely integrate with transfer hook-enabled tokens through a robust whitelisting mechanism.

## Overview

This is an enhanced version of the Raydium Constant Product AMM that adds comprehensive support for:

- **Token-2022 Transfer Hooks**: Full compatibility with tokens that have transfer hook extensions
- **TokenBadge Whitelisting System**: Controlled onboarding of transfer hook programs through validation
- **Enhanced Pool Operations**: All AMM functions (swap, deposit, withdraw) work seamlessly with hook tokens
- **Safety Guarantees**: Ensures transfer hook programs comply with strict operational rules

## Key Features

### 🔄 **Full Token-2022 Support**
- Native integration with Token-2022 program
- Automatic handling of additional accounts required by transfer hooks
- Optimized transaction construction for hook-enabled tokens

### 🏷️ **TokenBadge Whitelisting System**
The core innovation is the **TokenBadge** system that enables controlled support for transfer hook tokens:

- **Authority-Based Control**: Only designated `token_badge_authority` can whitelist tokens
- **Per-Config Flexibility**: Each AMM config can have different token policies
- **Compliance Enforcement**: Only tokens meeting safety criteria receive badges
- **Pool Creation Gates**: Transfer hook tokens require valid TokenBadge to create pools

### 📋 **Transfer Hook Compliance Rules**

Transfer hook programs must adhere to strict guidelines to be eligible for TokenBadge:

- **📖 Publicly Available Code**: Source code must be open and verifiable
- **🔍 Verifiable Build**: Code and on-chain program must match
- **🔒 Safe Operations**: Only perform risk-free operations (e.g., logging)
- **🚫 Non-Blocking**: Must not block transfers or interfere with pool operations
- **⚡ Minimal Accounts**: Cannot request excessive additional accounts
- **💰 No Fees**: Cannot impose additional transfer fees
- **🔄 No Token Transfers**: Cannot initiate token transfers (including SOL/WSOL)

## Program Architecture

### Core AMM Program
**Program ID**: `HJP61gQgQTzTkT7eXfz3WCzfiF2KmPhVWE2e4Yjc4VLT`

Main instructions include:
- `initialize_v2`: Enhanced pool creation with transfer hook support
- `initialize_token_badge`: Whitelist transfer hook tokens
- `swap_base_input/output`: Trading with automatic hook handling
- `deposit/withdraw`: Liquidity operations with hook compatibility

### TokenBadge System

```rust
#[account]
pub struct TokenBadge {
    pub amm_config: Pubkey,  // Associated AMM config
    pub token_mint: Pubkey,  // Whitelisted token mint
}
```

TokenBadges are PDAs with seeds: `[b"token_badge", amm_config, token_mint]`

## Instructions

### Core AMM Operations

#### `initialize_v2`
Enhanced pool creation supporting transfer hook tokens.

**Key Features:**
- Validates TokenBadge for transfer hook tokens
- Handles additional accounts for hook execution
- Maintains compatibility with regular SPL tokens

#### `initialize_token_badge`
Creates a TokenBadge to whitelist a transfer hook token.

**Access Control:**
- Only callable by `token_badge_authority` of the AMM config
- Requires thorough vetting of the transfer hook program

#### `swap_base_input` / `swap_base_output`
Trading operations that work transparently with both regular and hook tokens.

**Transfer Hook Integration:**
- Automatically includes required additional accounts
- Uses `add_extra_accounts_for_execute_cpi` for proper hook execution
- Maintains transaction efficiency despite additional complexity

## Usage Example

### 1. Deploy and Whitelist a Transfer Hook Token

```typescript
// 1. Create AMM config with designated token badge authority
const ammConfig = await createAmmConfig(
  program,
  connection,
  owner,
  configIndex,
  tradeFeeRate,
  protocolFeeRate,
  fundFeeRate,
  createFee
);

// 2. Token badge authority whitelists compliant transfer hook token
const tokenBadge = await program.methods
  .initializeTokenBadge()
  .accounts({
    ammConfig: ammConfigAddress,
    tokenBadgeAuthority: tokenBadgeAuthority.publicKey,
    tokenMint: transferHookTokenMint,
    tokenBadge: tokenBadgeAddress,
    funder: funder.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([tokenBadgeAuthority, funder])
  .rpc();

// 3. Create pool with transfer hook token
await program.methods
  .initializeV2(initAmount0, initAmount1, openTime)
  .accounts({
    creator: creator.publicKey,
    ammConfig: ammConfigAddress,
    poolState: poolAddress,
    token0Mint: transferHookTokenMint,
    token1Mint: regularTokenMint,
    token0Badge: tokenBadgeAddress, // Required for transfer hook token
    token1Badge: PublicKey.default, // Not needed for regular token
    // ... other accounts
  })
  .remainingAccounts(transferHookAccounts)
  .signers([creator])
  .rpc();
```

### 2. Trading with Transfer Hook Tokens

```typescript
// Swaps work transparently once pool is created
await program.methods
  .swapBaseInput(amountIn, minimumAmountOut)
  .accounts({
    payer: trader.publicKey,
    ammConfig: ammConfigAddress,
    poolState: poolAddress,
    inputTokenAccount: traderInputAccount,
    outputTokenAccount: traderOutputAccount,
    // ... vault and mint accounts
  })
  .remainingAccounts(transferHookAccounts) // Automatically handled
  .signers([trader])
  .rpc();
```

## Safety Mechanisms

### 1. **Controlled Onboarding**
- Only pre-approved transfer hook programs can create pools
- Token badge authority acts as gatekeeper
- Multiple AMM configs allow different risk tolerances

### 2. **Runtime Validation**
- Transfer hook tokens must have valid TokenBadge
- Additional account requirements are validated
- Transaction size limits prevent DoS attacks

### 3. **Compliance Enforcement**
Transfer hook programs undergo evaluation for:
- Code transparency and auditability
- Non-interference with AMM operations
- Reasonable additional account requirements
- Absence of fee extraction mechanisms

## Test Transfer Hook Program

**Program ID**: `HEngeJQLoaujgA44QRLCMVtDWKcx8mvhQErfRgKXGQKs`

This project includes a simple transfer hook program for testing purposes that:
- Logs token transfers with amount information
- Maintains a global transfer counter
- Demonstrates compliant transfer hook behavior
- Serves as a reference implementation for developers

The test hook exemplifies all compliance rules:
- ✅ Open source and transparent
- ✅ Only performs logging (no blocking)
- ✅ Minimal additional accounts (just a counter)
- ✅ No fee extraction
- ✅ No token transfers initiated

## Building and Testing

### Prerequisites
- Rust 1.70+
- Solana CLI tools
- Anchor Framework 0.31.1+

### Build
```bash
anchor build
```

### Test
```bash
# Run full test suite including transfer hook integration
anchor test

# Run specific transfer hook tests
yarn test tests/initializev2.test.ts
```

## Project Structure

```
programs/
├── raydium-cp-swap-token-22/     # Main AMM program with transfer hook support
│   ├── src/
│   │   ├── instructions/
│   │   │   ├── v2/               # Transfer hook enhanced instructions
│   │   │   └── ...
│   │   ├── states/
│   │   │   ├── config.rs         # AmmConfig and TokenBadge definitions
│   │   │   └── ...
│   │   └── utils/
│   │       ├── remaining_accounts_utils.rs  # Transfer hook account management
│   │       └── token.rs          # Enhanced token operations
│   └── ...
└── test_transfer_hook_program/   # Reference transfer hook implementation
    └── src/lib.rs
```

## Security Considerations

- **Authority Management**: Token badge authorities should be carefully managed
- **Hook Vetting**: Thorough review required before issuing TokenBadges
- **Account Limits**: Transfer hooks with excessive account requirements should be rejected
- **Fee Monitoring**: Ensure hooks don't impose hidden fees
- **Upgrade Controls**: Consider transfer hook upgrade authorities

## Contributing

When proposing new transfer hook integrations:

1. **Submit Hook for Review**: Provide complete source code and documentation
2. **Demonstrate Compliance**: Show adherence to all safety rules
3. **Testing**: Include comprehensive test coverage
4. **Documentation**: Clear explanation of hook behavior and restrictions

## License

This project follows the same licensing terms as the Raydium protocol.