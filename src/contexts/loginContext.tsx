import React, { createContext, useContext, useEffect } from 'react';
import Header from '../components/Header';
import PropTypes from 'prop-types';
import { useLogin } from '../effects/useLogin';

export interface loginContextType {
	login: Function;
	isSignedIn: boolean;
	loaded: boolean;
	error: Error;
	address: string;
	isIncorrectAddress: boolean;
	checkLogin: Function;
}

export const loginContext = createContext({
	login: null,
	isSignedIn: false,
	loaded: false,
	error: null,
	address: null,
});

function LoginContextProvider({ children }) {
	const {
		login,
		isSignedIn,
		loaded,
		error,
		address,
		isIncorrectAddress,
		checkLogin,
	} = useLogin();

	return (
		<loginContext.Provider
			value={
				{
					login,
					isSignedIn,
					loaded,
					error,
					address,
					isIncorrectAddress,
					checkLogin,
				} as loginContextType
			}
		>
			{loaded ? (
				<>{children}</>
			) : (
				<Header
					theme="acid"
					initialText="Initializing Web3 Connection..."
					showFinder={false}
				/>
			)}
		</loginContext.Provider>
	);
}

LoginContextProvider.propTypes = {
	children: PropTypes.any,
};

export default LoginContextProvider;
