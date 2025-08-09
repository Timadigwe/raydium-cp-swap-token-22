import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { RaydiumCpSwapToken22 } from "../target/types/raydium_cp_swap_token_22";
import { initializeV2, setupInitializeTestV2, createTokenBadge } from "./utils";
import { assert } from "chai";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { getAccount, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { TestTransferHookProgram } from "../target/types/test_transfer_hook_program";

describe("initialize test", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const owner = anchor.Wallet.local().payer;
    console.log("owner: ", owner.publicKey.toString());

    const program = anchor.workspace.raydiumCpSwapToken22 as Program<RaydiumCpSwapToken22>;
    const testTransferHookProgram = anchor.workspace.testTransferHookProgram as Program<TestTransferHookProgram>;

    const confirmOptions = {
        skipPreflight: true,
    };


    it("create pool with token2022 mint that transfer hook", async () => {

        const { configAddress, token0, token0Program, token1, token1Program } =
            await setupInitializeTestV2(
                program,
                anchor.getProvider().connection,
                owner,
                {
                    config_index: 0,
                    tradeFeeRate: new BN(10),
                    protocolFeeRate: new BN(1000),
                    fundFeeRate: new BN(25000),
                    create_fee: new BN(100000000),
                },
                testTransferHookProgram.programId,
                confirmOptions
            );

        const initAmount0 = new BN(10000000000);
        const initAmount1 = new BN(10000000000);

        //Custom
        //Initialize Meta using test transfer hook program
        const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), token1.toBuffer()],
            testTransferHookProgram.programId
        );

        const [counterAccountPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("counter")],
            testTransferHookProgram.programId
        );

        console.log(`Token1: ${token1}`);
        console.log(`Extra account Metalist PDA: ${extraAccountMetaListPDA}`);
        console.log(`Counter account PDA: ${counterAccountPDA}`);
        
        const initializeExtraAccountMetaListInstruction = await testTransferHookProgram.methods
            .initializeExtraAccountMetaList()
            .accountsStrict({
                payer: owner.publicKey,
                extraAccountMetaList: extraAccountMetaListPDA,
                mint: token1,
                counterAccount: counterAccountPDA,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .instruction();

        const transaction = new Transaction().add(initializeExtraAccountMetaListInstruction);

        
        const txSig = await sendAndConfirmTransaction(
            anchor.getProvider().connection,
            transaction,
            [owner],
            {
                skipPreflight: false,
                commitment: "confirmed",
            }
        );
        console.log("Transaction Signature:", txSig);
        const tx = await anchor.getProvider().connection.getTransaction(txSig, {
            commitment: "confirmed",
        });
        console.log(tx?.meta?.logMessages?.join("\n"));

        // Create token badges for both tokens
        console.log("🏷️ Creating token badges...");
        await createTokenBadge(
            program,
            anchor.getProvider().connection,
            owner, // token badge authority
            owner, // funder
            configAddress,
            token0,
            confirmOptions
        );

        await createTokenBadge(
            program,
            anchor.getProvider().connection,
            owner, // token badge authority 
            owner, // funder
            configAddress,
            token1,
            confirmOptions
        );

        const result = await initializeV2(
            program,
            owner,
            configAddress,
            token0,
            token0Program,
            token1,
            token1Program,
            extraAccountMetaListPDA,
            testTransferHookProgram.programId,
            confirmOptions,
            { initAmount0, initAmount1 },
            anchor.getProvider().connection
        ).catch((err) => {
            console.error({ message: "Error", err });
            throw err;
        });
        
        const { poolAddress, poolState } = result;

        let vault0 = await getAccount(
            anchor.getProvider().connection,
            poolState.token0Vault,
            "processed",
            poolState.token0Program
        );
        assert.equal(vault0.amount.toString(), initAmount0.toString());

        let vault1 = await getAccount(
            anchor.getProvider().connection,
            poolState.token1Vault,
            "processed",
            poolState.token1Program
        );
        assert.equal(vault1.amount.toString(), initAmount1.toString());
    });
});
