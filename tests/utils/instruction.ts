import { Program, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { RaydiumCpSwapToken22 } from "../../target/types/raydium_cp_swap_token_22";
import {
  Connection,
  ConfirmOptions,
  PublicKey,
  Keypair,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  accountExist,
  sendTransaction,
  getAmmConfigAddress,
  getAuthAddress,
  getPoolAddress,
  getPoolLpMintAddress,
  getPoolVaultAddress,
  createTokenMintAndAssociatedTokenAccount,
  getOrcleAccountAddress,
  getTokenBadgeAddress,
} from "./index";

import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { createTokenMintAndAssociatedTokenAccountV2 } from "./util";

export async function setupInitializeTest(
  program: Program<RaydiumCpSwapToken22>,
  connection: Connection,
  owner: Signer,
  config: {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    create_fee: BN;
  },
  transferFeeConfig: { transferFeeBasisPoints: number; MaxFee: number } = {
    transferFeeBasisPoints: 0,
    MaxFee: 0,
  },
  confirmOptions?: ConfirmOptions
) {
  const [{ token0, token0Program }, { token1, token1Program }] =
    await createTokenMintAndAssociatedTokenAccount(
      connection,
      owner,
      new Keypair(),
      transferFeeConfig
    );
  const configAddress = await createAmmConfig(
    program,
    connection,
    owner,
    config.config_index,
    config.tradeFeeRate,
    config.protocolFeeRate,
    config.fundFeeRate,
    config.create_fee,
    confirmOptions
  );
  return {
    configAddress,
    token0,
    token0Program,
    token1,
    token1Program,
  };
}

export async function setupInitializeTestV2(
  program: Program<RaydiumCpSwapToken22>,
  connection: Connection,
  owner: Signer,
  config: {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    create_fee: BN;
  },
  transferHookProgramId: PublicKey,
  confirmOptions?: ConfirmOptions
) {
  const [{ token0, token0Program }, { token1, token1Program }] =
    await createTokenMintAndAssociatedTokenAccountV2(
      connection,
      owner,
      new Keypair(),
      // transferFeeConfig
      transferHookProgramId
    );
  const configAddress = await createAmmConfig(
    program,
    connection,
    owner,
    config.config_index,
    config.tradeFeeRate,
    config.protocolFeeRate,
    config.fundFeeRate,
    config.create_fee,
    confirmOptions
  );
  return {
    configAddress,
    token0,
    token0Program,
    token1,
    token1Program,
  };
}

export async function setupDepositTest(
  program: Program<RaydiumCpSwapToken22>,
  connection: Connection,
  owner: Signer,
  config: {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    create_fee: BN;
  },
  transferFeeConfig: { transferFeeBasisPoints: number; MaxFee: number } = {
    transferFeeBasisPoints: 0,
    MaxFee: 0,
  },
  confirmOptions?: ConfirmOptions,
  initAmount: { initAmount0: BN; initAmount1: BN } = {
    initAmount0: new BN(10000000000),
    initAmount1: new BN(20000000000),
  },
  tokenProgramRequired?: {
    token0Program: PublicKey;
    token1Program: PublicKey;
  }
) {
  const configAddress = await createAmmConfig(
    program,
    connection,
    owner,
    config.config_index,
    config.tradeFeeRate,
    config.protocolFeeRate,
    config.fundFeeRate,
    config.create_fee,
    confirmOptions
  );

  while (1) {
    const [{ token0, token0Program }, { token1, token1Program }] =
      await createTokenMintAndAssociatedTokenAccount(
        connection,
        owner,
        new Keypair(),
        transferFeeConfig
      );

    if (tokenProgramRequired != undefined) {
      if (
        token0Program.equals(tokenProgramRequired.token0Program) &&
        token1Program.equals(tokenProgramRequired.token1Program)
      ) {
        return await initialize(
          program,
          owner,
          configAddress,
          token0,
          token0Program,
          token1,
          token1Program,
          confirmOptions,
          initAmount
        );
      }
    } else {
      return await initialize(
        program,
        owner,
        configAddress,
        token0,
        token0Program,
        token1,
        token1Program,
        confirmOptions,
        initAmount
      );
    }
  }
}

export async function setupSwapTest(
  program: Program<RaydiumCpSwapToken22>,
  connection: Connection,
  owner: Signer,
  config: {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    create_fee: BN;
  },
  transferFeeConfig: { transferFeeBasisPoints: number; MaxFee: number } = {
    transferFeeBasisPoints: 0,
    MaxFee: 0,
  },
  confirmOptions?: ConfirmOptions
) {
  const configAddress = await createAmmConfig(
    program,
    connection,
    owner,
    config.config_index,
    config.tradeFeeRate,
    config.protocolFeeRate,
    config.fundFeeRate,
    config.create_fee,
    confirmOptions
  );

  const [{ token0, token0Program }, { token1, token1Program }] =
    await createTokenMintAndAssociatedTokenAccount(
      connection,
      owner,
      new Keypair(),
      transferFeeConfig
    );

  const { poolAddress, poolState } = await initialize(
    program,
    owner,
    configAddress,
    token0,
    token0Program,
    token1,
    token1Program,
    confirmOptions
  );

  await deposit(
    program,
    owner,
    poolState.ammConfig,
    poolState.token0Mint,
    poolState.token0Program,
    poolState.token1Mint,
    poolState.token1Program,
    new BN(10000000000),
    new BN(100000000000),
    new BN(100000000000),
    confirmOptions
  );
  return { configAddress, poolAddress, poolState };
}


export async function createAmmConfig(
  program: Program<RaydiumCpSwapToken22>,
  connection: Connection,
  owner: Signer,
  config_index: number,
  tradeFeeRate: BN,
  protocolFeeRate: BN,
  fundFeeRate: BN,
  create_fee: BN,
  confirmOptions?: ConfirmOptions
): Promise<PublicKey> {
  const [address, _] = await getAmmConfigAddress(
    config_index,
    program.programId
  );
  if (await accountExist(connection, address)) {
    return address;
  }

  const ix = await program.methods
    .createAmmConfig(
      config_index,
      tradeFeeRate,
      protocolFeeRate,
      fundFeeRate,
      create_fee
    )
    .accounts({
      owner: owner.publicKey,
      ammConfig: address,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  await sendTransaction(connection, [ix], [owner], confirmOptions);
  console.log("✅ AMM config created");
  return address;
}

export async function createTokenBadge(
  program: Program<RaydiumCpSwapToken22>,
  connection: Connection,
  tokenBadgeAuthority: Signer,
  funder: Signer,
  ammConfigAddress: PublicKey,
  tokenMint: PublicKey,
  confirmOptions?: ConfirmOptions
): Promise<PublicKey> {
  const [tokenBadgeAddress, _] = await getTokenBadgeAddress(
    ammConfigAddress,
    tokenMint,
    program.programId
  );

  // Check if token badge already exists
  if (await accountExist(connection, tokenBadgeAddress)) {
    return tokenBadgeAddress;
  }

  console.log("🏷️ Creating token badge for:", tokenMint.toString());

  const ix = await program.methods
    .initializeTokenBadge()
    .accountsStrict({
      ammConfig: ammConfigAddress,
      tokenBadgeAuthority: tokenBadgeAuthority.publicKey,
      tokenMint: tokenMint,
      tokenBadge: tokenBadgeAddress,
      funder: funder.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = await sendTransaction(connection, [ix], [tokenBadgeAuthority, funder], confirmOptions);
  console.log("✅ Token badge created, tx:", tx);
  return tokenBadgeAddress;
}

export async function initialize(
  program: Program<RaydiumCpSwapToken22>,
  creator: Signer,
  configAddress: PublicKey,
  token0: PublicKey,
  token0Program: PublicKey,
  token1: PublicKey,
  token1Program: PublicKey,
  confirmOptions?: ConfirmOptions,
  initAmount: { initAmount0: BN; initAmount1: BN } = {
    initAmount0: new BN(10000000000),
    initAmount1: new BN(20000000000),
  },
  createPoolFee = new PublicKey("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8")
) {
  try {
    console.log("🔧 Initializing pool...");

    const [auth] = await getAuthAddress(program.programId);
    const [poolAddress] = await getPoolAddress(configAddress, token0, token1, program.programId);
    const [lpMintAddress] = await getPoolLpMintAddress(poolAddress, program.programId);
    const [vault0] = await getPoolVaultAddress(poolAddress, token0, program.programId);
    const [vault1] = await getPoolVaultAddress(poolAddress, token1, program.programId);
    const [observationAddress] = await getOrcleAccountAddress(poolAddress, program.programId);

    const [creatorLpTokenAddress] = await PublicKey.findProgramAddress(
      [
        creator.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        lpMintAddress.toBuffer(),
      ],
      ASSOCIATED_PROGRAM_ID
    );

    const creatorToken0 = getAssociatedTokenAddressSync(token0, creator.publicKey, false, token0Program);
    const creatorToken1 = getAssociatedTokenAddressSync(token1, creator.publicKey, false, token1Program);

    console.log("📍 Pool:", poolAddress.toString());
    console.log("💰 Amounts:", initAmount.initAmount0.toString(), "/", initAmount.initAmount1.toString());

    const ix = await program.methods
      .initialize(initAmount.initAmount0, initAmount.initAmount1, new BN(0))
      .accountsPartial({
        creator: creator.publicKey,
        ammConfig: configAddress,
        authority: auth,
        poolState: poolAddress,
        token0Mint: token0,   
        token1Mint: token1,
        lpMint: lpMintAddress,
        creatorToken0,
        creatorToken1,
        creatorLpToken: creatorLpTokenAddress,
        token0Vault: vault0,
        token1Vault: vault1,
        createPoolFee,
        observationState: observationAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        token0Program: token0Program,
        token1Program: token1Program,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    await sendTransaction(anchor.getProvider().connection, [ix], [creator], confirmOptions);

    console.log("✅ Pool initialized successfully!");
    
    const poolState = await program.account.poolState.fetch(poolAddress);
    return { poolAddress, poolState };
  } catch (error) {
    console.error("❌ Initialize failed:", error.message || error);
    
    // Only show logs if they exist and are helpful
    if (error.logs && error.logs.length > 0) {
      const relevantLogs = error.logs.filter(log => 
        log.includes("Error") || 
        log.includes("failed") || 
        log.includes("Custom") ||
        log.includes("ProgramError")
      );
      if (relevantLogs.length > 0) {
        console.error("📋 Error logs:", relevantLogs.slice(-5)); // Only last 5 relevant logs
      }
    }
    
    throw error;
  }
}

export async function initializeV2(
  program: Program<RaydiumCpSwapToken22>,
  creator: Signer,
  configAddress: PublicKey,
  token0: PublicKey,
  token0Program: PublicKey,
  token1: PublicKey,
  token1Program: PublicKey,
  extraAccountMetaListPDA: PublicKey,
  transferHookProgramId: PublicKey,

  confirmOptions?: ConfirmOptions,
  initAmount: { initAmount0: BN; initAmount1: BN } = {
    initAmount0: new BN(10000000000),
    initAmount1: new BN(20000000000),
  },
  connection?: Connection,
  createPoolFee = new PublicKey("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8")
) {
  const [auth] = await getAuthAddress(program.programId);
  const [poolAddress] = await getPoolAddress(
    configAddress,
    token0,
    token1,
    program.programId
  );
  const [lpMintAddress] = await getPoolLpMintAddress(poolAddress, program.programId);
  const [vault0] = await getPoolVaultAddress(poolAddress, token0, program.programId);
  const [vault1] = await getPoolVaultAddress(poolAddress, token1, program.programId);
  const [creatorLpTokenAddress] = await PublicKey.findProgramAddress(
    [creator.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), lpMintAddress.toBuffer()],
    ASSOCIATED_PROGRAM_ID
  );

  const [observationAddress] = await getOrcleAccountAddress(
    poolAddress,
    program.programId
  );

  const creatorToken0 = getAssociatedTokenAddressSync(
    token0,
    creator.publicKey,
    false,
    token0Program
  );
  const creatorToken1 = getAssociatedTokenAddressSync(
    token1,
    creator.publicKey,
    false,
    token1Program
  );

  // Derive counter account for test transfer hook program
  const [counterAccountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter")],
    transferHookProgramId
  );

  console.log(`🔧 Transfer Hook Program ID: ${transferHookProgramId}`);
  console.log(`📍 Counter Account PDA: ${counterAccountPDA}`);
  console.log(`📍 Extra Account Meta List: ${extraAccountMetaListPDA}`);

  // Derive token badge addresses
  const [tokenBadge0] = await getTokenBadgeAddress(configAddress, token0, program.programId);
  const [tokenBadge1] = await getTokenBadgeAddress(configAddress, token1, program.programId);

  const txSig = await program.methods
    .initializeV2(initAmount.initAmount0, initAmount.initAmount1, new BN(0))
    .accountsPartial({
      creator: creator.publicKey,
      ammConfig: configAddress,
      authority: auth,
      poolState: poolAddress,
      token0Mint: token0,
      token1Mint: token1,
      lpMint: lpMintAddress,
      creatorToken0,
      creatorToken1,
      creatorLpToken: creatorLpTokenAddress,
      token0Vault: vault0,
      token1Vault: vault1,
      tokenBadge0,
      tokenBadge1,
      createPoolFee,
      observationState: observationAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
      token0Program: token0Program,
      token1Program: token1Program,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      transferHookProgram: transferHookProgramId,
      extraAccountMetaList: extraAccountMetaListPDA,
    })
    .remainingAccounts([
      // Counter account required by the test transfer hook
      {
        pubkey: counterAccountPDA,
        isSigner: false,
        isWritable: true,
      },
    ])
    .rpc();
  console.log(txSig);

  await connection.confirmTransaction(txSig, "confirmed");
  const tx = await connection.getTransaction(txSig, {
    commitment: "confirmed",
  });
  console.log(tx);
  console.log(tx?.meta?.logMessages?.join("\n"));

  const poolState = await program.account.poolState.fetch(poolAddress);
  return { poolAddress, poolState };
}


export async function deposit(
  program: Program<RaydiumCpSwapToken22>,
  owner: Signer,
  configAddress: PublicKey,
  token0: PublicKey,
  token0Program: PublicKey,
  token1: PublicKey,
  token1Program: PublicKey,
  lp_token_amount: BN,
  maximum_token_0_amount: BN,
  maximum_token_1_amount: BN,
  confirmOptions?: ConfirmOptions
) {
  const [auth] = await getAuthAddress(program.programId);
  const [poolAddress] = await getPoolAddress(
    configAddress,
    token0,
    token1,
    program.programId
  );

  const [lpMintAddress] = await getPoolLpMintAddress(
    poolAddress,
    program.programId
  );
  const [vault0] = await getPoolVaultAddress(
    poolAddress,
    token0,
    program.programId
  );
  const [vault1] = await getPoolVaultAddress(
    poolAddress,
    token1,
    program.programId
  );
  const [ownerLpToken] = await PublicKey.findProgramAddress(
    [
      owner.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      lpMintAddress.toBuffer(),
    ],
    ASSOCIATED_PROGRAM_ID
  );

  const onwerToken0 = getAssociatedTokenAddressSync(
    token0,
    owner.publicKey,
    false,
    token0Program
  );
  const onwerToken1 = getAssociatedTokenAddressSync(
    token1,
    owner.publicKey,
    false,
    token1Program
  );

  const tx = await program.methods
    .deposit(lp_token_amount, maximum_token_0_amount, maximum_token_1_amount)
    .accountsStrict({
      owner: owner.publicKey,
      authority: auth,
      poolState: poolAddress,
      ownerLpToken,
      token0Account: onwerToken0,
      token1Account: onwerToken1,
      token0Vault: vault0,
      token1Vault: vault1,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      vault0Mint: token0,
      vault1Mint: token1,
      lpMint: lpMintAddress,
    })
    .rpc(confirmOptions);
  return tx;
}

export async function withdraw(
  program: Program<RaydiumCpSwapToken22>,
  owner: Signer,
  configAddress: PublicKey,
  token0: PublicKey,
  token0Program: PublicKey,
  token1: PublicKey,
  token1Program: PublicKey,
  lp_token_amount: BN,
  minimum_token_0_amount: BN,
  minimum_token_1_amount: BN,
  confirmOptions?: ConfirmOptions
) {
  const [auth] = await getAuthAddress(program.programId);
  const [poolAddress] = await getPoolAddress(
    configAddress,
    token0,
    token1,
    program.programId
  );

  const [lpMintAddress] = await getPoolLpMintAddress(
    poolAddress,
    program.programId
  );
  const [vault0] = await getPoolVaultAddress(
    poolAddress,
    token0,
    program.programId
  );
  const [vault1] = await getPoolVaultAddress(
    poolAddress,
    token1,
    program.programId
  );
  const [ownerLpToken] = await PublicKey.findProgramAddress(
    [
      owner.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      lpMintAddress.toBuffer(),
    ],
    ASSOCIATED_PROGRAM_ID
  );

  const onwerToken0 = getAssociatedTokenAddressSync(
    token0,
    owner.publicKey,
    false,
    token0Program
  );
  const onwerToken1 = getAssociatedTokenAddressSync(
    token1,
    owner.publicKey,
    false,
    token1Program
  );

  const tx = await program.methods
    .withdraw(lp_token_amount, minimum_token_0_amount, minimum_token_1_amount)
    .accountsStrict({
      owner: owner.publicKey,
      authority: auth,
      poolState: poolAddress,
      ownerLpToken,
      token0Account: onwerToken0,
      token1Account: onwerToken1,
      token0Vault: vault0,
      token1Vault: vault1,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      vault0Mint: token0,
      vault1Mint: token1,
      lpMint: lpMintAddress,
      memoProgram: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    })
    .rpc(confirmOptions)
    .catch();

  return tx;
}

export async function swap_base_input(
  program: Program<RaydiumCpSwapToken22>,
  owner: Signer,
  configAddress: PublicKey,
  inputToken: PublicKey,
  inputTokenProgram: PublicKey,
  outputToken: PublicKey,
  outputTokenProgram: PublicKey,
  amount_in: BN,
  minimum_amount_out: BN,
  confirmOptions?: ConfirmOptions
) {
  const [auth] = await getAuthAddress(program.programId);
  const [poolAddress] = await getPoolAddress(
    configAddress,
    inputToken,
    outputToken,
    program.programId
  );

  const [inputVault] = await getPoolVaultAddress(
    poolAddress,
    inputToken,
    program.programId
  );
  const [outputVault] = await getPoolVaultAddress(
    poolAddress,
    outputToken,
    program.programId
  );

  const inputTokenAccount = getAssociatedTokenAddressSync(
    inputToken,
    owner.publicKey,
    false,
    inputTokenProgram
  );
  const outputTokenAccount = getAssociatedTokenAddressSync(
    outputToken,
    owner.publicKey,
    false,
    outputTokenProgram
  );
  const [observationAddress] = await getOrcleAccountAddress(
    poolAddress,
    program.programId
  );

  const tx = await program.methods
    .swapBaseInput(amount_in, minimum_amount_out)
    .accountsStrict({
      payer: owner.publicKey,
      authority: auth,
      ammConfig: configAddress,
      poolState: poolAddress,
      inputTokenAccount,
      outputTokenAccount,
      inputVault,
      outputVault,
      inputTokenProgram: inputTokenProgram,
      outputTokenProgram: outputTokenProgram,
      inputTokenMint: inputToken,
      outputTokenMint: outputToken,
      observationState: observationAddress,
    })
    .rpc(confirmOptions);

  return tx;
}

export async function swap_base_output(
  program: Program<RaydiumCpSwapToken22>,
  owner: Signer,
  configAddress: PublicKey,
  inputToken: PublicKey,
  inputTokenProgram: PublicKey,
  outputToken: PublicKey,
  outputTokenProgram: PublicKey,
  amount_out_less_fee: BN,
  max_amount_in: BN,
  confirmOptions?: ConfirmOptions
) {
  const [auth] = await getAuthAddress(program.programId);
  const [poolAddress] = await getPoolAddress(
    configAddress,
    inputToken,
    outputToken,
    program.programId
  );

  const [inputVault] = await getPoolVaultAddress(
    poolAddress,
    inputToken,
    program.programId
  );
  const [outputVault] = await getPoolVaultAddress(
    poolAddress,
    outputToken,
    program.programId
  );

  const inputTokenAccount = getAssociatedTokenAddressSync(
    inputToken,
    owner.publicKey,
    false,
    inputTokenProgram
  );
  const outputTokenAccount = getAssociatedTokenAddressSync(
    outputToken,
    owner.publicKey,
    false,
    outputTokenProgram
  );
  const [observationAddress] = await getOrcleAccountAddress(
    poolAddress,
    program.programId
  );

  const tx = await program.methods
    .swapBaseOutput(max_amount_in, amount_out_less_fee)
    .accountsStrict({
      payer: owner.publicKey,
      authority: auth,
      ammConfig: configAddress,
      poolState: poolAddress,
      inputTokenAccount,
      outputTokenAccount,
      inputVault,
      outputVault,
      inputTokenProgram: inputTokenProgram,
      outputTokenProgram: outputTokenProgram,
      inputTokenMint: inputToken,
      outputTokenMint: outputToken,
      observationState: observationAddress,
    })
    .rpc(confirmOptions);

  return tx;
}
