import { ethers } from 'ethers';

export interface TransactionError {
  code?: number;
  message?: string;
}

export interface TransactionResult {
  success: boolean;
  metadata?: any;
  error?: TransactionError;
}


// Use this as a base class for all protocols
// This class is abstract and should not be instantiated
// It is used to define the interface for all protocols

export abstract class Protocol {
  wallet: ethers.Wallet;
  signer: ethers.Signer;
  
  provider?: ethers.providers.Provider;
  supportedTokens?: string[];


  abstract swap: (swapArguments: any) => Promise<TransactionResult>;
  abstract deposit: (depositArguments: any) => Promise<TransactionResult>;
  abstract withdraw: (withdrawArguments: any) => Promise<TransactionResult>;

  constructor (wallet: ethers.Wallet) {
    this.wallet = wallet;
    this.signer = wallet;
  }
}

export default Protocol;
