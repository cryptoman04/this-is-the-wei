import * as ethers from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import Protocol, { TransactionResult } from '../Protocol';
import { Token } from '../../types';
import { ETH, ETH_ADDRESS_ZKSYNC, TOKENS, ZERO_ADDRESS } from '../../constants';
import * as dotenv from 'dotenv';

dotenv.config({path:"../../../.env"}); //didn't have to declare type


console.log(process.env['PRIVATE_KEY'])