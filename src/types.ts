export interface Token {
  price?: number;
  balance: string;
  contractAddress: string;
  decimals: number;
  name: string;
  symbol: string;
  type: string;
}