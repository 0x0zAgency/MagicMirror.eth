import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { useContext, useEffect, useState } from 'react';
import { apiFetch, getEndpointHref } from '../api';
import { Web3Context } from '../contexts/web3Context';

const domain = window.location.host;

async function createSiweMessage(
	address: any,
	statement: string
): Promise<string> {
	const response = await fetch(getEndpointHref() + 'wallet/nonce');
	let json = await response.json();
	const message = new SiweMessage({
		domain,
		address,
		statement,
		uri: origin,
		version: '1',
		chainId: 1,
		nonce: json.nonce,
	});

	return message.prepareMessage();
}

export const useLogin = () => {
	const [error, setError] = useState(null);
	const [loaded, setLoaded] = useState(false);
	const [isSignedIn, setIsSignedIn] = useState(false);
	const [isIncorrectAddress, setIsIncorrectAddress] = useState(false);
	const [address, setAddress] = useState(null); // [1]
	const web3Context = useContext(Web3Context);

	useEffect(() => {
		setLoaded(false);
		setError(null);

		if (!web3Context.loaded) return;

		checkLogin()
			.then((result) => {
				if (!result) {
					setIsSignedIn(false);
					console.log('not signed in');
					return;
				}

				(async () => {
					if ((await getAddress()) !== web3Context.walletAddress) {
						setIsSignedIn(false);
						setError('Incorrect address');
						setIsIncorrectAddress(true);
						setLoaded(true);
						console.log('incorrect address');
						return;
					}

					console.log('signed in & valid');
					setIsSignedIn(result);
					setAddress(web3Context.walletAddress);
					setIsIncorrectAddress(false);
					setLoaded(true);
				})();
			})
			.catch((err) => {
				setError(err);
				setIsSignedIn(false);
			})
			.finally(() => {
				setLoaded(true);
			});
	}, [web3Context.loaded]);

	const checkLogin = async () => {
		let result = await apiFetch('wallet', 'verify', null, 'GET');
		return result.verified;
	};

	const destroy = async () => {
		try {
			let result = await apiFetch('wallet', 'destroy', null, 'POST');
		} catch (error) {
		} finally {
			setIsSignedIn(false);
			setAddress(null);
			setIsIncorrectAddress(false);
			setError(null);
		}
	};

	const getAddress = async () => {
		let result = await apiFetch('wallet', 'verify', null, 'GET');
		return result?.address;
	};

	const login = async () => {
		setLoaded(false);
		setError(null);

		try {
			if (!web3Context.walletAddress || !web3Context.walletConnected) {
				setLoaded(true);
				setIsSignedIn(false);
				setError('Please connect your wallet');
				return;
			}

			const message = await createSiweMessage(
				web3Context.walletAddress,
				'Sign in with Ethereum to the app.'
			);
			const signature = await web3Context.signer.signMessage(message);
			const response = await fetch(getEndpointHref() + 'wallet/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ message, signature }),
			});

			if (!response.ok) {
				setError(response.body);
			} else if (response.status === 200) {
				setIsSignedIn(true);
				setAddress(web3Context.walletAddress);
			} else {
				setError('Something went wrong');
			}
		} catch (error) {
			setError(error);
		} finally {
			setLoaded(true);
		}
	};

	return {
		login,
		loaded,
		isSignedIn,
		error,
		address,
		checkLogin,
		isIncorrectAddress,
		destroy,
	};
};
