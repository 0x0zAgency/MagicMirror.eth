import React, { useCallback, useContext, useEffect, useState } from 'react';
// Page Routing
import { useHistory } from 'react-router-dom';
//Storage Controller & Config

import config from '../../config';
import { Web3Context } from '../../contexts/web3Context';
import { LoginContext } from '../../contexts/loginContext';
import Hero from '../../components/Hero';
import WebEvents from '../../webEvents';
import { apiFetch } from '../../api';
import Loading from '../../components/Loading';
import storage from '../../storage';

function EnsClub() {
	const context = useContext(Web3Context);
	const loginContext = useContext(LoginContext);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(false);

	const [hasOnboard, setHasOnboard] = useState(false);

	const fetchENS = useCallback(async () => {
		setLoading(true);
		await apiFetch('ens', 'fetch', {
			address: context.walletAddress,
		}).catch((e) => {
			setError(e);
		});

		setSuccess(true);
		setLoading(false);

		storage.setGlobalPreference(
			'hasOnboard_' + context.walletAddress,
			true
		);
		setHasOnboard(true);
		window.postMessage({
			onboard: true,
		});
	}, []);

	useEffect(() => {
		if (!context.loaded || !loginContext.loaded) return;
		if (context.walletConnected && loginContext.isSignedIn) {
			if (
				!storage.getGlobalPreference(
					'hasOnboard_' + context.walletAddress
				)
			)
				fetchENS();
			else {
				setSuccess(true);
				setHasOnboard(true);
				window.postMessage({
					onboard: true,
				});
			}
		}
	}, [fetchENS, context, loginContext]);

	return (
		<div
			data-theme={
				storage.getGlobalPreference('defaultTheme') ||
				config.defaultTheme ||
				'forest'
			}
		>
			<Hero
				style={{
					backgroundImage: 'url(/img/10kbg.png)',
				}}
			>
				<div className="hero-content">
					<div className="flex flex-col p-2">
						<div className="flex flex-col w-full p-2 bg-gray-200 border rounded">
							<div className="flex flex-row w-full border-b border-gray-500 mb-2">
								<p className="text-4xl text-black ">🖖</p>
							</div>
							{!success ? (
								<div className="card bg-info mt-2 mb-2">
									<div className="card-body text-center text-black">
										<p className="text-3xl ">
											Welcome 10kClub!
										</p>

										<p hidden={context.walletConnected}>
											Please connect your wallet to allow
											Magic🪞.eth.
										</p>

										<p hidden={loginContext.isSignedIn}>
											Please login to Magic🪞.eth.
										</p>

										<p className="pt-5 border-t border-sky-500">
											Once you have connected and we have
											pulled your domains. You will be
											able to claim a 10k Club Membership
											for each digit you own
										</p>
									</div>
								</div>
							) : (
								<div className="card bg-success mt-2 mb-2">
									<div className="card-body text-center text-black">
										<p className="text-3xl ">Success</p>
										<p>
											You have successfully connected your
											ethereum properties to magic mirror
											and they can now be accessed by the
											10k club minter.
										</p>
										<p className="pt-5 border-t border-green-500">
											<a href="https://10kclub.infinitymint.app/mint">
												<u>Go to 10k Club Minter</u>
											</a>
										</p>
									</div>
								</div>
							)}
							{loading ? (
								<Loading />
							) : (
								<div className="flex flex-col items-center justify-center">
									{error ? (
										<div className="card bg-error mt-2 mb-2">
											<div className="card-body text-center text-black">
												<p className="text-3xl ">
													Error
												</p>
												<p>
													{error?.message
														? error.message
														: 'Unknown error'}
												</p>
											</div>
										</div>
									) : null}
									<div
										className="flex flex-col gap-2 w-full p-2"
										hidden={
											context.walletConnected ||
											hasOnboard
										}
									>
										<button
											className="btn btn-primary"
											hidden={context.walletConnected}
											onClick={async () => {
												try {
													await config.onboard.walletSelect();
													await config.onboard.walletCheck();
												} catch (error) {
													console.log(error);
												}
												WebEvents.emit('reload');
											}}
										>
											Connect Wallet
										</button>
									</div>
									<div
										className="flex flex-col gap-2 w-full p-2"
										hidden={
											!context.walletConnected ||
											hasOnboard ||
											loginContext.isSignedIn
										}
									>
										<button
											className="btn btn-primary"
											hidden={context.walletConnected}
											onClick={async () => {
												try {
													await loginContext.login();
												} catch (error) {
													console.log(error);
												}
												WebEvents.emit('reload');
											}}
										>
											Login / Register
										</button>
									</div>
									<div
										className="flex flex-col gap-2 w-full p-2"
										hidden={
											!context.walletConnected ||
											!loginContext.isSignedIn ||
											hasOnboard
										}
									>
										<button
											className="btn btn-primary"
											hidden={!context.walletConnected}
											onClick={async () => {}}
										>
											Fetch Properties
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</Hero>
		</div>
	);
}

export default EnsClub;