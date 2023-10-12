import * as zksync from 'zksync-web3';
import * as ethers from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import Protocol, { TransactionResult } from '../Protocol';
import { Token } from '../../types';
import { ETH, ETH_ADDRESS_ZKSYNC, TOKENS, ZERO_ADDRESS } from '../../constants';



const erc20_abi = require('./abis/erc20.json');
const syncswaprouter_abi = require('./abis/syncswaprouter.json');
const syncswapvault_abi = require('./abis/syncswapvault.json');
const syncswapclassicpool_abi = require('./abis/syncswapclassicpool.json');
const pool_abi = require('./abis/pool.json');


const zkSyncProvider = new zksync.Provider('https://zksync-era.rpc.thirdweb.com');

export interface SyncSwapProtocolSwapData {
  fromToken: Token;
  fromTokenSwapAmount: ethers.BigNumber;
  toToken: {
    contractAddress: string;
    symbol?: string;
  };
}

export interface SyncSwapProtocolDepositData {
  token1Address: string;
  token2Address?: string;
  token1Amount: ethers.BigNumber;
  token2Amount?: ethers.BigNumber;
  poolAddress?: string;
  token: Token;
}

export interface SyncSwapProtocolWithdrawalData {
  poolAddress: string;
  withdrawalAmount: ethers.BigNumber; // Amount will be based on LP token
  lpToken: Token; // This will be an LP token
}



class SyncSwap implements Protocol {
  static VAULT = '0x621425a1Ef6abE91058E9712575dcc4258F8d091';
  static ROUTER = '0x2da10A1e27bF85cEdD8FFb1AbBe97e53391C0295';
  static CLASSIC_POOL_FACTORY = '0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb';
  static ETH_USDC_POOL = '0x80115c708E12eDd42E504c1cD52Aea96C547c05c';


  routerContract = zksync.Contract; 
  vaultContract = new zksync.Contract(SyncSwap.VAULT, syncswapvault_abi);

  classicPoolContract = new zksync.Contract(
    SyncSwap.CLASSIC_POOL_FACTORY,
    syncswapclassicpool_abi
  );

  signer: zksync.Wallet;

  wallet: ethers.Wallet;

  whitelistedPools = {
    ETH_USDC_POOL: '0x80115c708E12eDd42E504c1cD52Aea96C547c05c',
    ETH_USDT_POOL: '0xd3D91634Cf4C04aD1B76cE2c06F7385A897F54D3',
    ETH_BUSD_POOL: // Using ETH-DAI Pool on Testnet: https://syncswap.xyz/pool/0xe52940eDDa6ec5FDabef7C33B9C1E1d613BbA144
   '0xaD86486f1d225D624443e5DF4B2301d03bBe70f6',
    USDC_USDT_POOL: '0x0E595bfcAfb552F83E25d24e8a383F88c1Ab48A4',
    USDC_BUSD_POOL: '0x69B9A2efacE47419D496d9A550A162185999ACE5',
    ETH_DAI_POOL: '0xaD86486f1d225D624443e5DF4B2301d03bBe70f6',
    USDC_DAI_POOL: '0x69B9A2efacE47419D496d9A550A162185999ACE5',
  };

  supportedTokens: string[] =
      [
        'ETH',
        'USDC',
        'USDT',
        'USD+',
        'LUSD',
        'BUSD',
        'WBTC',
        'ceAVAX',
        'MAV',
        'MUTE',
      ];


  excludeList: string[] = ['DAI', 'BUSD'];

  constructor(wallet: ethers.Wallet) {
    let signer = new zksync.Wallet(wallet.privateKey);
    signer = signer.connect(zkSyncProvider);
    this.signer = signer;
    this.wallet = wallet;

    this.routerContract = new zksync.Contract(
      SyncSwap.ROUTER,
      syncswaprouter_abi,
      signer
    );

    this.vaultContract = new zksync.Contract(
      SyncSwap.VAULT,
      syncswapvault_abi,
      signer
    );

    this.classicPoolContract = new zksync.Contract(
      SyncSwap.CLASSIC_POOL_FACTORY,
      syncswapclassicpool_abi,
      signer
    );
  }

  // TODO: Need to check if approval is needed to save gas
  // TODO: Need to add a revoke approval function
  // TODO: Need to only approve required amount for deposit
  approveERC20 = async (token, spenderAddress: string) => {
    console.log('Approving ERC-20 Token....💰');
    const erc20Contract = new zksync.Contract(
      token.contractAddress,
      erc20_abi,
      this.signer
    );

    const amountToApprove = ethers.utils.parseUnits(
      token.balance,
      Number(token.decimals)
    );

    await erc20Contract.approve(spenderAddress, amountToApprove);
    console.log('Approved ERC-20 Token! 🎉');
  };

  swap = async (swapData: SyncSwapProtocolSwapData) => {
    console.log('Swapping tokens 🔄', swapData);

    try {
      const { fromToken, toToken, fromTokenSwapAmount } = swapData;

      let fromAddress = fromToken.contractAddress.toLowerCase();
      let toAddress = toToken.contractAddress.toLowerCase();

      if (
        fromAddress === ZERO_ADDRESS.toLowerCase() ||
        fromAddress === ETH_ADDRESS_ZKSYNC.toLowerCase()
      )
        fromAddress = TOKENS.WETH.contractAddress.ZKSYNC;
      if (
        toAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
        toAddress.toLowerCase() === ETH_ADDRESS_ZKSYNC.toLowerCase()
      )
        toAddress = TOKENS.WETH.contractAddress.ZKSYNC;

      const poolAddress: string = await this.classicPoolContract.getPool(
        fromAddress,
        toAddress
      );

      const poolContract = new zksync.Contract(
        poolAddress,
        pool_abi,
        this.signer
      );
      const amountOut = await poolContract.getAmountOut(
        fromAddress,
        fromTokenSwapAmount,
        this.signer?.address
      );

      if (fromToken.symbol !== 'ETH') {
        await this.approveERC20(fromToken, poolAddress);
      }

      const encodedSwapData: string = defaultAbiCoder.encode(
        ['address', 'address', 'uint8'],
        [fromAddress, this.signer?.address, 1] // tokenIn, to, withdraw mode
      );

      const steps = [
        {
          pool: poolAddress,
          data: encodedSwapData,
          callback: ZERO_ADDRESS, // we don't have a callback
          callbackData: '0x',
        },
      ];

      const paths = [
        {
          steps,
          tokenIn:
            fromToken.contractAddress.toLowerCase() ===
              ZERO_ADDRESS.toLowerCase() ||
            fromToken.contractAddress.toLowerCase() ===
              ETH_ADDRESS_ZKSYNC.toLowerCase()
              ? ZERO_ADDRESS
              : fromToken.contractAddress,
          amountIn: fromTokenSwapAmount,
        },
      ];

      console.log('ARGS', [
        paths,
        ethers.BigNumber.from(amountOut).div(100).mul(98).toString(), // amountOutMin // Note: ensures slippage here
        ethers.BigNumber.from(Math.floor(Date.now() / 1000)) // TODO: Might be incorrect!
          .add(1800)
          .toString(), // deadline // 30 minutes
      ]);

      const swapArgs = [
        paths,
        ethers.BigNumber.from(amountOut).div(100).mul(98), // amountOutMin // Note: ensures slippage here
        ethers.BigNumber.from(Math.floor(Date.now() / 1000)).add(1800), // deadline // 30 minutes
      ];

      if (fromToken.symbol === 'ETH')
        swapArgs.push({ value: ethers.BigNumber.from(fromTokenSwapAmount) });

      const response = await this.routerContract.swap(...swapArgs);

      await response.wait();

      console.log('Syncswap Swap Completed Successfully ✅');
      return { success: true };
    } catch (err) {
      console.log('Error processing swap: ', err);
      return { success: false };
    }
  };

  // TODO: We need to be able to support multitoken deposits
  // currently we only support single asset deposits
  // TODO: Need to set a min USDvalue amount to deposit. If the amount
  // is too small, then the deposit will fail.
  deposit = async (depositArguments: SyncSwapProtocolDepositData) => {
    if (!this.signer) return { success: false };

    try {
      console.log('💰 depositing into syncswap vault.....', depositArguments);

      let { token1Address, token1Amount, token2Address } = depositArguments;
      const { poolAddress, token } = depositArguments;

      token1Address = token1Address.toLowerCase();
      token2Address = token2Address?.toLowerCase();

      if (
        token1Address.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
        token1Address.toLowerCase() !== ETH_ADDRESS_ZKSYNC.toLowerCase() &&
        poolAddress
      ) {
        await this.approveERC20(token, poolAddress);
      }

      const data = ethers.utils.zeroPad(this.signer.address, 32);
      const transactionArgs = [
        poolAddress,
        [
          {
            token:
              token1Address === ETH_ADDRESS_ZKSYNC.toLowerCase()
                ? ZERO_ADDRESS
                : token1Address,
            amount: ethers.BigNumber.from(token1Amount),
          },
          {
            token: ZERO_ADDRESS,
            amount: ethers.BigNumber.from(0),
          },
        ],
        data,
        ethers.BigNumber.from(0),
        ZERO_ADDRESS,
        '0x',
      ];

      if (token.symbol === ETH)
        transactionArgs.push({ value: ethers.BigNumber.from(token1Amount) });

      console.log('ARGS', transactionArgs);
      const response = await this.routerContract.addLiquidity2(
        ...transactionArgs
      );

      await response.wait();
      console.log('Syncswap Deposit Completed Successfully ✅', response);
      return { success: true }
    } catch (err) {
      console.log('Error processing deposit', err);
      return { success: false };
    }
  };

  // TODO: ADD ABILITY TO WITHDRAW MULTIPLE TOKENS
  // CURRENTLY WE ONLY SUPPORT SINGLE ASSET WITHDRAWALS

  // TODO: We need to randomize the withdrawn token. Currently we only
  // withdraw ETH.
  withdraw = async (withdrawalData: SyncSwapProtocolWithdrawalData) => {
    if (!this.signer) return { success: false };

    try {
      console.log('💰 withdrawing from syncswap vault.....', withdrawalData);

      const { poolAddress, lpToken, withdrawalAmount } = withdrawalData;
      const data = ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint8'],
        [TOKENS.WETH.contractAddress.ZKSYNC, this.signer.address, 1]
      );
      console.log('ROUTER ADDRESS', this.routerContract.address);
      await this.approveERC20(lpToken, this.routerContract.address);

      const response = await this.routerContract.burnLiquiditySingle(
        poolAddress,
        ethers.BigNumber.from(withdrawalAmount),
        data,
        ethers.BigNumber.from(0),
        ZERO_ADDRESS,
        '0x'
      );

      await response.wait();

      console.log('Syncswap Withdrawal Completed Successfully ✅', response);
      return { success: true };
    } catch (err) {
      console.log('Error processing withdrawal from Syncswap', err);
      return { success: false };
    }
  };
}

export default SyncSwap;
