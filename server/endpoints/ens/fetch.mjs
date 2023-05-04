import { success, userError, isLoggedIn } from '../../utils/helpers.mjs';
import server from '../../server.mjs';

export const get = async (req, res) => {
	await post(req, res);
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const post = async (req, res) => {
	if ((await isLoggedIn(req, server)) !== true)
		return userError(res, await isLoggedIn(req, server));

	let address = req.session.siwe.address;
	let lastFetched = await server.prisma.lastFetched.findFirst({
		where: {
			address: address,
		},
	});

	//if last fetched less than an hour ago, return
	if (
		lastFetched &&
		lastFetched.lastFetched &&
		lastFetched.lastFetched >
			(lastFetched.isPowerUser
				? Date.now() - 1000 * 60 * 60
				: Date.now() - 1000 * 60 * 5)
	)
		return userError(
			res,
			lastFetched.isPowerUser
				? 'You must wait at least 1 hour before fetching again'
				: 'You must wait at least 5 minutes before fetching again'
		);

	try {
		let totalCount = 0;
		let fetchNFTS = async (currentAddress, pageKey) => {
			let nfts = await server.alchemy.nft.getNftsForOwner(
				'0xDFF917ab602e8508b6907dE1b038dd52B24A2379',
				{
					contractAddresses: [
						'0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
					],
					pageKey: pageKey,
				}
			);

			for (let i = 0; i < nfts.ownedNfts.length; i++) {
				let nft = nfts.ownedNfts[i];

				totalCount++;

				if (!nft.title || nft.title.length === 0) continue;

				await server.prisma.eNS.upsert({
					where: {
						tokenId: nft.tokenId,
					},
					update: {
						tokenId: nft.tokenId,
						ownerAddress: currentAddress,
						ensContractAddress: nft.contract.address,
						domainName: nft.title,
						nftUri: nft.tokenUri,
						nftName: nft.title,
						nftDescription: nft.description,
						nftMedia: nft.media,
					},
					create: {
						tokenId: nft.tokenId,
						ownerAddress: currentAddress,
						ensContractAddress: nft.contract.address,
						domainName: nft.title,
						nftUri: nft.tokenUri,
						nftName: nft.title,
						nftDescription: nft.description,
						nftMedia: nft.media,
					},
				});
			}

			if (nfts.pageKey) await fetchNFTS(currentAddress, nfts.pageKey);
		};

		await fetchNFTS(address);
		await server.prisma.lastFetched.upsert({
			where: {
				address: address,
			},
			update: {
				lastFetched: new Date(),
				isPowerUser: totalCount > 100,
			},
			create: {
				address: address,
				lastFetched: new Date(),
				isPowerUser: totalCount > 100,
			},
		});

		return success(res, {
			success: true,
			totalCount: totalCount,
		});
	} catch (error) {
		console.log(error);
		return userError(res, 'Bad Address');
	}
};
