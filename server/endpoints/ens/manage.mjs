import server from '../../server.mjs';
import { ethers } from 'ethers';

export const settings = {
	requireLogin: false,
	requireTicket: false,
	admin: false,
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const post = async (req, res) => {
	let { domainName, address } = req.body;
	address = address || res.session.siwe.address;

	if (!address) return userError(res, 'Missing address');
	if (!ethers.utils.isAddress(address))
		return userError(res, 'Invalid address');

	let provider = server.infinityConsole.getProvider();
	let resolver = await provider.getResolver(domainName);
	let masterAddress = await resolver.getAddress();
	let autoAccept = false;
	if (masterAddress == address) autoAccept = true;

	//now create a new manager row
	let manager = await server.prisma.manager.upsert({
		data: {
			domainName,
			managerAddress: address,
			approved: autoAccept,
		},
		where: {
			domainName: {
				domainName,
			},
		},
		update: {
			approved: autoAccept,
		},
	});

	return success(res, {
		accepted: autoAccept,
		id: manager.id,
	});
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const get = async (req, res) => {};

/**
 * Uncomment to specify path, otherwise it will be inferred from the file name and location
 */
// export const path = '/<folder/dirs>/<this_file_name>';
