import FixedElements from '../../components/FixedElements';
import { useHistory } from 'react-router-dom';
import contentHash from 'content-hash';
import { useRef, useState } from 'react';

export default function ContentHash() {
	const history = useHistory();
	const hash = useRef(null);
	const [decoded, setDecoded] = useState('');
	const [error, setError] = useState(null);
	const decode = () => {
		setError(null);
		try {
			if (hash.current.value === '')
				throw new Error('please enter a content hash');

			const decoded = contentHash.decode(hash.current.value);
			setDecoded(decoded);
		} catch (e) {
			console.log(e);
			setError(e);
		}
	};

	return (
		<>
			<div className="hero min-h-screen">
				<div className="hero-overlay bg-opacity-60" />
				<div className="hero-content text-center text-neutral-content bg-gray-500">
					<div className="max-w-xl">
						<h1 className="mb-5 text-5xl font-bold text-black">
							Content Hash Decoder
						</h1>
						<p className="mb-5 text-black">
							Please enter a content hash to decode
						</p>
						<input
							className="input input-bordered w-full mb-2"
							ref={hash}
						></input>
						{error === null ? (
							<p className="mb-5 text-success mt-2">{decoded}</p>
						) : (
							<p className="mb-5 text-error mt-2">{error.message}</p>
						)}
						<button
							className="btn btn-dark w-full"
							onClick={() => {
								decode();
							}}
						>
							Decode
						</button>
						<button
							className="btn btn-dark w-full mt-2"
							onClick={() => {
								history.push('/utilities/');
							}}
						>
							Dashboard
						</button>
						<button
							className="btn btn-dark w-full mt-2"
							onClick={() => {
								history.push('/');
							}}
						>
							Home
						</button>
					</div>
				</div>
			</div>
			<FixedElements useFixed={false}></FixedElements>
		</>
	);
}