export const MINIMUM_ETH_AMOUNT_WEI = '3000000000000000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ETH_ADDRESS_ZKSYNC = '0x000000000000000000000000000000000000800a';



export const ETH = 'ETH';
export const USDC = 'USDC';


export const TOKENS = {
	ETH: {
		symbol: 'ETH',
		decimals: 18,
		contractAddress: {
			ZKSYNC: ETH_ADDRESS_ZKSYNC,
		},
	},
	WETH: {
		symbol: 'WETH',
		decimals: 18,
		contractAddress: {
			ZKSYNC: ETH_ADDRESS_ZKSYNC,
			ZKSYNC_MUTE: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'
		},
	},
	USDC: {
		symbol: 'USDC',
		decimals: 6,
		contractAddress: {
			ZKSYNC: '0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4',
		},
	},
}