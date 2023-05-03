import prettier from 'html-prettify';
import { ethers } from 'ethers';
import { prepareAvatar } from './effects/useENSContext';
import contentHash from 'content-hash';

export const getFastAvatar = async (address: string, web3Provider) => {
	const resolver = await web3Provider.getResolver(address);

	if (resolver === null) {
		return '/img/0x0z.jpg';
	}

	try {
		return await prepareAvatar(resolver, web3Provider, null, null);
	} catch (error) {
		return '/img/0x0z.jpg';
	}
};

export const setEnsTextRecord = async (
	ensDomain: string,
	resolverAddress: string,
	text: string,
	provider: ethers.providers.Provider,
	signer: ethers.Signer,
	record: string = 'contentHash'
) => {
	let node = ethers.utils.namehash(ensDomain);
	let abi = ['function setText(bytes32 node, string key, string value)'];
	const contract = new ethers.Contract(resolverAddress, abi, provider);
	const contractWithSigner = contract.connect(signer);
	const tx = await contractWithSigner.setText(node, record, text);
	return tx;
};

export const setENSContentHash = async (
	ensDomain: string,
	resolverAddress: string,
	ipfsContentHash: string,
	provider: ethers.providers.Provider,
	signer: ethers.Signer,
	encoding: 'ipfs-ns' | 'ipns-ns' | 'swarm-ns' = 'ipfs-ns'
) => {
	let node = ethers.utils.namehash(ensDomain);
	let abi = ['function setContenthash(bytes32 node, bytes hash)'];
	let hash = contentHash.encode(ipfsContentHash, encoding);
	const contract = new ethers.Contract(resolverAddress, abi, provider);
	const contractWithSigner = contract.connect(signer);
	const tx = await contractWithSigner.setContenthash(node, hash);
	return tx;
};

/**
 *
 * @param currentCode
 * @param selectedTab
 * @returns
 */
export const prettifyCode = (currentCode: string, selectedTab = 'html') => {
	if (selectedTab === 'html') {
		currentCode = prettier(currentCode);
		//remove double spaces
		currentCode = currentCode.replace(/  /g, ' ');
		//prettify the code
		return currentCode;
	}

	if (selectedTab === 'js' || selectedTab === 'css') {
		//remove all tabs
		currentCode = currentCode.replace(/\t/g, '');
		//remove the white space before the first character on each line
		currentCode = currentCode.replace(/^\s+/gm, '');
		//if the line ends with a curly brace then add a new line
		currentCode = currentCode.replace(/}\s*$/gm, '\n}');
		//if the line ends with a curly brace then add a new line
		currentCode = currentCode.replace(/{\s*$/gm, '{\n');
		//loop through each line, adding tabs where necessary

		if (currentCode.indexOf('}') !== -1 && currentCode.indexOf('{') !== -1) {
			let lines = currentCode.split('\n');
			let newLines = [];
			let tabCount = 0;
			for (let i = 0; i < lines.length; i++) {
				let line = lines[i];
				if (line.includes('}')) {
					tabCount--;
				}

				if (tabCount < 0) tabCount = 0;
				newLines.push('\t'.repeat(tabCount) + line);
				if (line.includes('{')) {
					tabCount++;
				}
			}
			currentCode = newLines.join('\n');
		}

		//remove empty lines
		currentCode = currentCode.replace(/^\s*[\r\n]/gm, '');

		return currentCode;
	}

	if (selectedTab === 'json' || selectedTab == '.xens') {
		currentCode = JSON.stringify(JSON.parse(currentCode), null, 2);
		return currentCode;
	}

	return currentCode;
};

/**
 *
 * @param str
 * @returns
 */
export const base64Encode = (str: string) => {
	return Buffer.from(str).toString('base64');
};

/**
 *
 * @param str
 * @param encoding
 * @returns
 */
export const base64Decode = (str: string, encoding?: BufferEncoding) => {
	return Buffer.from(str, 'base64').toString(encoding || 'utf8');
};
